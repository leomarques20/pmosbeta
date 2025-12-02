
/*
 * PMOS — Google-style AI Function (Streaming ND-JSON)
 * Endpoint: /.netlify/functions/ai
 * Requer: GEMINI_API_KEY (env) e opcionalmente GOOGLE_CLOUD_PROJECT
 * Auth: Authorization: Bearer <Firebase ID Token>
 */
export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST" };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY ausente." }) };
  }

  let uid = null;
  try {
    uid = await verifyFirebaseToken(event.headers.authorization);
  } catch {}
  if (!uid) {
    return { statusCode: 401, body: JSON.stringify({ error: "Não autenticado." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido" }) };
  }

  const { prompt = "", context = "", mode = "chat" } = body;

  // Busca memórias relevantes (stub vectorStore)
  const vs = await getVectorStore();
  const memories = await vs.search(uid, prompt, 5);

  const fullPrompt = buildPrompt(prompt, context, memories);

  // Chamada streaming ao Gemini 1.5 Pro (streamGenerateContent → ND-JSON fakeado por linhas)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Gemini error", details: t }) };
    }
    const data = await resp.json();
    // A API v1beta não devolve stream aqui; vamos emitir em blocos por frase simulando ND-JSON
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const chunks = text.split(/(?<=[\.\!\?])\s+/).filter(Boolean);
    const nd = chunks.map(c => f"data: " + JSON.stringify({ chunk: c }) + "\n").join("")

    return {
      statusCode: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: nd
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Falha ao consultar Gemini", message: String(e) }) };
  }
}

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

// ---- Vector Store (stub para Pinecone ou Firebase Ext) ----
async function getVectorStore() {
  return {
    async search(uid, query, topK=5) { return []; },
    async upsert(uid, text, metadata={}) { return true; }
  };
}

// ---- Auth Firebase (verifica ID Token) ----
async function verifyFirebaseToken(header) {
  if (!header || !header.startsWith("Bearer ")) return null;
  const idToken = header.slice("Bearer ".length);
  // neste ambiente plano de function Netlify sem admin SDK, aceitamos token não-nulo
  return "uid"; // stub — troque por verificação real com firebase-admin em ambiente compatível
}
