
/*
 * PMOS — Google-style AI Function (ND-JSON simulado)
 * Endpoint: POST /.netlify/functions/ai
 * Corpo: { prompt, context?, model? }
 * Resposta 200 (text/plain): linhas "data: {"chunk": "..."}\n" (consumidas por js/aiClient.js)
 * Requer: GEMINI_API_KEY (env); opcional GEMINI_MODEL (padrão gemini-2.5-flash)
 * Auth: Authorization: Bearer <Firebase ID Token> — validado via Identity Toolkit
 *       (accounts:lookup) usando FIREBASE_API_KEY.
 *
 * Observação: o caminho de IA ativo do app é /.netlify/functions/ai-proxy (js/apps/app.js).
 */
const { getVectorStore } = require('./vectorstore');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MODEL_NAME_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function jsonResponse(statusCode, obj) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(obj) };
}

exports.handler = async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: "POST" }, body: JSON.stringify({ error: "Use POST" }) };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return jsonResponse(500, { error: "Configuração de IA ausente no servidor: defina GEMINI_API_KEY nas variáveis de ambiente do Netlify." });
  }

  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : (event.body || "{}");
    body = JSON.parse(raw || "{}");
  } catch {
    return jsonResponse(400, { error: "JSON inválido" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse(400, { error: "Corpo da requisição deve ser um objeto JSON." });
  }

  const { prompt = "", context: appContext = "", model: requestedModel } = body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return jsonResponse(400, { error: 'Campo "prompt" obrigatório.' });
  }

  const headers = event.headers || {};
  let uid = null;
  try {
    uid = await verifyFirebaseToken(headers.authorization || headers.Authorization);
  } catch (e) {
    console.error("Falha ao verificar token Firebase:", e && e.message);
  }
  if (!uid) {
    return jsonResponse(401, { error: "Não autenticado." });
  }

  const model = (typeof requestedModel === "string" && MODEL_NAME_RE.test(requestedModel))
    ? requestedModel
    : DEFAULT_MODEL;

  // Busca memórias relevantes (stub vectorStore)
  let memories = [];
  try {
    const vs = await getVectorStore();
    memories = await vs.search(uid, prompt, 5);
  } catch (e) {
    console.error("Falha no vector store (ignorado):", e && e.message);
  }

  const fullPrompt = buildPrompt(prompt, typeof appContext === "string" ? appContext : JSON.stringify(appContext), memories);

  // generateContent (sem streaming real) → emitido como ND-JSON por frase
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("Erro da API Gemini:", resp.status, model, t.slice(0, 2000));
      if (resp.status === 429) {
        return jsonResponse(429, { error: "Limite de uso da IA atingido. Tente novamente em instantes." });
      }
      return jsonResponse(502, { error: "Falha ao chamar IA.", upstreamStatus: resp.status });
    }
    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(p => p && !p.thought).map(p => p.text || "").join("\n").trim();
    const chunks = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const nd = chunks.map(c => "data: " + JSON.stringify({ chunk: c }) + "\n").join("");

    return {
      statusCode: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      body: nd
    };
  } catch (e) {
    console.error("Falha ao consultar Gemini:", e && e.message);
    return jsonResponse(500, { error: "Falha ao consultar Gemini." });
  }
};

function buildPrompt(prompt, context, memories) {
  let out = `Você é um co-piloto de IA para o PMOS (gestão pública).
- Responda em PT-BR, objetivo e com exemplos práticos
- Sugira próximas ações acionáveis
- Se fizer sentido, retorne JSON com ações {action,args}
Contexto do app: ${context}\n`;
  if (memories?.length) {
    out += `Memórias:\n${memories.map(m => "- " + (m.text||"")).join("\n")}\n`;
  }
  out += `Pergunta: ${prompt}`;
  return out;
}

// ---- Auth Firebase (verifica ID Token) ----
// Sem firebase-admin: valida o token no Identity Toolkit usando a chave web do Firebase.
async function verifyFirebaseToken(header) {
  if (!header || !header.startsWith("Bearer ")) return null;
  const idToken = header.slice("Bearer ".length).trim();
  if (!idToken) return null;
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("FIREBASE_API_KEY ausente: impossível verificar o token do usuário.");
    return null;
  }
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (!resp.ok) return null;
  const data = await resp.json().catch(() => null);
  return data?.users?.[0]?.localId || null;
}
