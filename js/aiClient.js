
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
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data:')) continue;
        yield JSON.parse(line.slice(5));
      }
    }
  }
  stop(){ this.abortController?.abort(); }
  async _getIdToken(){
    try { return await firebase.auth().currentUser.getIdToken(); } catch { return "anon"; }
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
