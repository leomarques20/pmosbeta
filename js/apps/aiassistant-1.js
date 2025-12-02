
import { AIClient } from '../aiClient.js';
export function openAIAssistant() {
  const winId = window.windowManager?.createWindow?.('Assistente IA (Google)', '', { width: 700, height: 600, appType: 'ai-assistant' });
  if (!winId) { alert('Window manager não encontrado.'); return; }
  const winData = window.windowManager.windows.get(winId);
  const el = winData.element.querySelector('.window-content');
  el.classList.add('ai-assistant-app-container');
  el.innerHTML = `
    <div class="ai-chat-display"></div>
    <div class="ai-chat-input">
      <input type="text" placeholder="Pergunte algo…">
      <button class="app-button">Enviar</button>
    </div>`;
  const display = el.querySelector('.ai-chat-display');
  const input = el.querySelector('input');
  const btn = el.querySelector('button');
  const ai = new AIClient({ uid: firebase.auth().currentUser?.uid, appContext:'PMOS-Chat'});
  const append = (who, html) => {
    const div = document.createElement('div');
    div.className = `ai-chat-${who}-message`;
    div.innerHTML = `<strong>${who==='user'?'Você':'IA'}:</strong> ${html}`;
    display.appendChild(div); display.scrollTop = display.scrollHeight;
  };
  async function send() {
    const text = input.value.trim(); if(!text) return;
    append('user', text); input.value='';
    let buffer = ''; let botDiv=null;
    for await (const { chunk } of ai.stream(text)) {
      buffer += chunk;
      if (!botDiv) { botDiv = document.createElement('div'); botDiv.className='ai-chat-bot-message'; botDiv.innerHTML = `<strong>IA:</strong> ${buffer}`; display.appendChild(botDiv); }
      else { botDiv.innerHTML = `<strong>IA:</strong> ${buffer}`; }
      display.scrollTop = display.scrollHeight;
    }
  }
  btn.onclick = send;
  input.onkeypress = e => { if (e.key === 'Enter') send(); };
}
