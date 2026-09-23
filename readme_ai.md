# PMOS AI — Integração (Google AI Studio / Gemini)
Siga estes passos no Netlify:
1) Defina as variáveis de ambiente (Site → Settings → Environment variables):
   - `GEMINI_API_KEY` (obrigatória, secreta — nunca vai para o navegador)
   - `GEMINI_MODEL` (opcional; padrão `gemini-2.5-flash`)
2) Faça o deploy. O endpoint usado pelo app é `POST /.netlify/functions/ai-proxy`
   (`netlify/functions/ai-proxy.js`), chamado pelos painéis de IA em `js/apps/app.js`.
   - Corpo: `{ "prompt": "...", "appType": "...", "uiLocale": "pt-BR" }`
     (opcionais: `systemInstruction`, `model`, `fileContent`, `fileName`, `fileType`, `fileKind`)
   - Resposta: `{ "text": "..." }` ou `{ "error": "..." }` com status 4xx/5xx
     (500 = `GEMINI_API_KEY` ausente; 429 = limite de uso; 502 = falha no Gemini/modelo inválido).
3) Em localhost (servidor estático) a IA não existe: use `netlify dev` para testar as funções.
