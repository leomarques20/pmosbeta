const https = require('https');

// Endpoint: POST /.netlify/functions/ai-proxy
// Corpo: { prompt, appType?, uiLocale?, systemInstruction?, model?, fileContent?, fileName?, fileType?, fileKind? }
// Resposta 200: { text }   | Erro: { error } com status 4xx/5xx
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MODEL_NAME_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function jsonResponse(statusCode, obj) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(obj) };
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...JSON_HEADERS, Allow: 'POST' },
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  // Lida a cada invocação para refletir alterações de ambiente sem cold start.
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY não configurada nas variáveis de ambiente do Netlify.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Configuração de IA ausente no servidor: defina GEMINI_API_KEY nas variáveis de ambiente do Netlify.' })
    };
  }

  let rawBody = event.body || '{}';
  if (event.isBase64Encoded) {
    rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
  }
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: 'Requisição muito grande para o ai-proxy.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('Erro ao parsear body JSON:', err.message);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'JSON inválido enviado ao ai-proxy.' })
    };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse(400, { error: 'Corpo da requisição deve ser um objeto JSON.' });
  }

  const {
    prompt,
    model: requestedModel,
    appType,
    uiLocale = 'pt-BR',
    systemInstruction,
    fileContent,
    fileName,
    fileType,
    fileKind
  } = payload;

  const model = (typeof requestedModel === 'string' && MODEL_NAME_RE.test(requestedModel))
    ? requestedModel
    : DEFAULT_MODEL;

  const hasPrompt = typeof prompt === 'string' && prompt.trim() !== '';
  const hasFile = typeof fileContent === 'string' && fileContent !== '';
  if (!hasPrompt && !hasFile) {
    return jsonResponse(400, { error: 'Campo "prompt" ou "fileContent" obrigatório.' });
  }

  const userTextParts = [];
  const extraParts = [];

  if (appType) {
    userTextParts.push(`Contexto da aplicação PMOS: ${String(appType).slice(0, 100)}`);
  }

  if (uiLocale) {
    userTextParts.push(`Idioma preferencial da resposta: ${String(uiLocale).slice(0, 20)}`);
  }

  // Imagens chegam como data URL (ai/pmos_ai.js): envia como inlineData em vez de texto base64.
  const dataUrlMatch = hasFile && /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(fileContent);
  if (dataUrlMatch) {
    userTextParts.push(`Arquivo anexado: ${fileName || 'arquivo sem nome'} (${dataUrlMatch[1]})`);
    extraParts.push({ inlineData: { mimeType: dataUrlMatch[1], data: dataUrlMatch[2].replace(/\s+/g, '') } });
  } else if (hasFile) {
    userTextParts.push(
      `=== Conteúdo de arquivo anexado ===
Nome: ${fileName || 'arquivo sem nome'}
Tipo MIME: ${fileType || 'desconhecido'}
Origem: ${fileKind || 'desconhecida'}

${fileContent}
=== Fim do conteúdo de arquivo ===`
    );
  }

  if (hasPrompt) {
    userTextParts.push(prompt.trim());
  }

  const fullUserText = userTextParts
    .filter((p) => p && String(p).trim())
    .join('\n\n');

  const geminiRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: fullUserText }, ...extraParts]
      }
    ]
  };
  if (systemInstruction && String(systemInstruction).trim()) {
    geminiRequest.systemInstruction = { parts: [{ text: String(systemInstruction).trim() }] };
  }
  const requestBody = JSON.stringify(geminiRequest);

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    method: 'POST',
    timeout: 25000,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
      'x-goog-api-key': GEMINI_API_KEY
    }
  };

  try {
    const apiResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Tempo esgotado ao chamar a API Gemini.'));
      });
      req.on('error', (err) => {
        reject(err);
      });

      req.write(requestBody);
      req.end();
    });

    if (apiResponse.statusCode < 200 || apiResponse.statusCode >= 300) {
      console.error('Erro da API Gemini:', apiResponse.statusCode, model, String(apiResponse.body).slice(0, 2000));
      // Não repassa 404/400 do Gemini como tal: o front interpreta 404 como "IA indisponível no ambiente local".
      const upstream = apiResponse.statusCode;
      const statusCode = upstream === 429 ? 429 : 502;
      const error = upstream === 429
        ? 'Limite de uso da IA atingido. Tente novamente em instantes.'
        : (upstream === 404
          ? `Modelo de IA "${model}" indisponível. Verifique GEMINI_MODEL.`
          : 'Falha ao chamar IA.');
      return jsonResponse(statusCode, { error, upstreamStatus: upstream });
    }

    let parsed;
    try {
      parsed = JSON.parse(apiResponse.body);
    } catch (err) {
      console.error('Erro ao parsear resposta da API Gemini:', err.message);
      return jsonResponse(502, { error: 'Resposta inválida da IA.' });
    }

    let text = '';
    try {
      if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
        const candidate = parsed.candidates[0];
        if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
          // Ignora partes de "pensamento" (thought) dos modelos 2.5.
          text = candidate.content.parts
            .filter((p) => p && !p.thought)
            .map((p) => p.text || '')
            .join('\n')
            .trim();
        }
      }
    } catch (err) {
      console.error('Erro ao extrair texto do retorno Gemini:', err);
    }

    if (!text) {
      const blockReason = parsed && parsed.promptFeedback && parsed.promptFeedback.blockReason;
      text = blockReason
        ? `A IA não respondeu porque o conteúdo foi bloqueado (${blockReason}).`
        : 'A IA respondeu sem conteúdo de texto utilizável.';
    }

    return jsonResponse(200, { text, model });
  } catch (err) {
    console.error('Erro inesperado ao chamar Gemini:', err && err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Erro ao comunicar com o serviço de IA.' })
    };
  }
};
