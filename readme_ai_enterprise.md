# PMOS AI 4.0 — Enterprise (Google‑style)

> ⚠️ **Nota de Segurança**: Nenhuma chave de API é versionada. Configure **GEMINI_API_KEY** no painel do seu provedor (Netlify/Vercel/Cloudflare). A função `/.netlify/functions/env` expõe apenas a configuração web do Firebase — nunca a chave do Gemini.

## Endpoints
- `/.netlify/functions/ai-proxy` — **endpoint ativo** do app (JSON `{ prompt, appType, uiLocale }` → `{ text }`).
- `/.netlify/functions/ai` — ND‑JSON simulado (`data: {"chunk": "..."}` por frase); exige `Authorization: Bearer <Firebase ID Token>`, validado com `FIREBASE_API_KEY`. Usado apenas por `js/aiClient.js` (não carregado pelo app atualmente).
- `/.netlify/functions/ai-memo-generator` — geração de memorandos do SEI.
- `/api/sei/processos`, `/api/sei/auth/challenge`, `/api/sei/detalhes` — redirecionados para as funções `sei-*` (ver `netlify.toml`).

Modelo: `GEMINI_MODEL` (padrão `gemini-2.5-flash`) em `ai-proxy` e `ai`; o cliente pode enviar `model` para sobrescrever.

## Client
- `js/aiClient.js` — cliente leve com `stream(prompt)` (para `/.netlify/functions/ai`)
- `js/apps/aiAssistant.js` — janela de chat integrada ao Window Manager (usa `ai-proxy`)

## Vector Store
- `netlify/functions/vectorstore.js` — stubs para Pinecone ou Firebase Extension **googleai/semantic-search** (chamada direta responde 501).

## Deploy Checklist
- **Env**: `GEMINI_API_KEY`, opcional `GEMINI_MODEL`, `FIREBASE_*` (web config), opcional `PINECONE_API_KEY`, `GOOGLE_CLOUD_PROJECT`
- **Backend Python** (`backend/`): apenas para desenvolvimento local (`uvicorn backend.main:app --port 8000`); o Netlify Functions não executa Python.
- **Dependências server** (functions): `google-auth-library`, `firebase-admin`, `@pinecone-database/pinecone` (ajuste conforme precisar).
