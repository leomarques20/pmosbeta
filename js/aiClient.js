
export class AIClient {
  constructor({ uid, appContext }) {
    this.uid = uid;
    this.appContext = appContext;
    this.abortController = null;
  }
  async *stream(prompt) {
    this.abortController = new AbortController();
    const res = await fetch('/.netlify/functions/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this._getIdToken()}`
      },
      body: JSON.stringify({ prompt, context: this.appContext }),
      signal: this.abortController.signal
    });
    if (!res.ok || !res.body) {
      let msg = `HTTP ${res.status}`;
      try { const data = await res.json(); if (data && data.error) msg = data.error; } catch { }
      throw new Error(msg);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data:')) continue;
        try { yield JSON.parse(line.slice(5)); } catch { /* linha malformada: ignora */ }
      }
    }
  }
  stop(){ this.abortController?.abort(); }
  async _getIdToken(){
    // O app usa o SDK modular do Firebase (js/auth.js) — não existe global `firebase`.
    try {
      const user = window.authManager?.auth?.currentUser;
      return user ? await user.getIdToken() : "";
    } catch { return ""; }
  }
  async complete(fields) {
    const prompt = `Preencha os campos (JSON only): ${JSON.stringify(fields)}`;
    let out = ''; for await (const { chunk } of this.stream(prompt)) out += " " + chunk;
    try { return JSON.parse(out); } catch { return {}; }
  }
  async suggestNextActions(data) {
    const prompt = `Sugira 3 próximas ações (JSON array): ${JSON.stringify(data)}`;
    let out=''; for await (const { chunk } of this.stream(prompt)) out += " " + chunk;
    try { return JSON.parse(out); } catch { return []; }
  }
}
