const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY não configurada nas variáveis de ambiente do Netlify.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Configuração de IA ausente no servidor.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    console.error('Erro ao parsear body JSON:', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'JSON inválido enviado ao ai-proxy.' })
    };
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
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Campo "prompt" ou "fileContent" obrigatório.' })
    };
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
      return {
        statusCode: apiResponse.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Falha ao chamar IA',
          statusCode: apiResponse.statusCode,
          details: apiResponse.body
        })
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(apiResponse.body);
    } catch (err) {
      console.error('Erro ao parsear resposta da API Gemini:', err);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Resposta inválida da IA',
          raw: apiResponse.body
        })
      };
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, raw: parsed })
    };
  } catch (err) {
    console.error('Erro inesperado ao chamar Gemini:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Erro ao comunicar com o serviço de IA.' })
    };
  }
};
