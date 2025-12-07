const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { error: 'Method not allowed. Use POST.' });
  }

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY não configurada nas variáveis de ambiente do Netlify.');
    return buildResponse(500, { error: 'Configuração de IA ausente no servidor.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    console.error('Erro ao parsear body JSON:', err);
    return buildResponse(400, { error: 'JSON inválido enviado ao ai-proxy.' });
  }

  const {
    prompt,
    model = 'gemini-2.0-flash',
    mode = 'free',
    appType,
    uiLocale = 'pt-BR',
    systemInstruction,
    fileContent,
    fileName,
    fileType,
    fileKind
  } = payload || {};

  if ((!prompt || typeof prompt !== 'string') && !fileContent) {
    return buildResponse(400, { error: 'Campo "prompt" ou "fileContent" obrigatório.' });
  }

  const userTextParts = [];

  if (systemInstruction) {
    userTextParts.push(String(systemInstruction).trim());
  }

  if (appType) {
    userTextParts.push(`Contexto da aplicação PMOS: ${appType}`);
  }

  if (uiLocale) {
    userTextParts.push(`Idioma preferencial da resposta: ${uiLocale}`);
  }

  if (fileContent) {
    userTextParts.push(
      `=== Conteúdo de arquivo anexado ===
Nome: ${fileName || 'arquivo sem nome'}
Tipo MIME: ${fileType || 'desconhecido'}
Origem: ${fileKind || 'desconhecida'}

${fileContent}
=== Fim do conteúdo de arquivo ===`
    );
  }

  if (prompt && typeof prompt === 'string') {
    userTextParts.push(prompt.trim());
  }

  const fullUserText = userTextParts
    .filter((p) => p && String(p).trim())
    .join('\n\n');

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          {
            text: fullUserText
          }
        ]
      }
    ]
  });

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
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

      req.on('error', (err) => {
        reject(err);
      });

      req.write(requestBody);
      req.end();
    });

    if (apiResponse.statusCode < 200 || apiResponse.statusCode >= 300) {
      console.error('Erro da API Gemini:', apiResponse.statusCode, apiResponse.body);
      const friendlyMessage = apiResponse.statusCode === 403
        ? 'Chave de API do Gemini recusada (403). Verifique se a variável GEMINI_API_KEY está correta e tem acesso à API.'
        : 'Falha ao chamar IA';
      return buildResponse(apiResponse.statusCode, {
        error: friendlyMessage,
        statusCode: apiResponse.statusCode,
        details: apiResponse.body
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(apiResponse.body);
    } catch (err) {
      console.error('Erro ao parsear resposta da API Gemini:', err);
      return buildResponse(502, {
        error: 'Resposta inválida da IA',
        raw: apiResponse.body
      });
    }

    let text = '';
    try {
      if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
        const candidate = parsed.candidates[0];
        if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
          text = candidate.content.parts.map((p) => p.text || '').join('\n').trim();
        }
      }
    } catch (err) {
      console.error('Erro ao extrair texto do retorno Gemini:', err);
    }

    if (!text) {
      text = 'A IA respondeu sem conteúdo de texto utilizável.';
    }

    return buildResponse(200, { text, raw: parsed });
  } catch (err) {
    console.error('Erro inesperado ao chamar Gemini:', err);
    return buildResponse(500, { error: 'Erro ao comunicar com o serviço de IA.' });
  }
};
