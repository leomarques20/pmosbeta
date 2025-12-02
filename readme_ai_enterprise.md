
# PMOS AI 4.0 — Enterprise (Google‑style)

> ⚠️ **Nota de Segurança**: Nenhuma chave de API é versionada. Configure **GEMINI_API_KEY** no painel do seu provedor (Netlify/Vercel/Cloudflare).

## Endpoints
- `/.netlify/functions/ai` — **Streaming ND‑JSON** (usa `GEMINI_API_KEY`)
- (legado) `/.netlify/functions/ai-proxy` — compatível, sem fallback de chaves

## Client
- `js/aiClient.js` — cliente leve com `stream(prompt)`
- `js/apps/aiAssistant.js` — janela de chat integrada ao Window Manager

## Vector Store
- `netlify/functions/vectorStore.js` — stubs para Pinecone ou Firebase Extension **googleai/semantic-search**.

## Deploy Checklist
- **Env**: `GEMINI_API_KEY`, opcional `PINECONE_API_KEY`, `GOOGLE_CLOUD_PROJECT`
- **Dependências server** (functions): `google-auth-library`, `firebase-admin`, `@pinecone-database/pinecone` (ajuste conforme precisar).
