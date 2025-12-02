
(() => {
  const STATE = { open: false, dryRun: false, lastResponse: null, history: [] };
  const AI_ENDPOINT = "/.netlify/functions/ai-proxy";
  const SYSTEM_INSTRUCTION = `Você é o PMOS AI 4.0... (mesmo conteúdo da versão longa)`;

  // Anexo inteligente de arquivos para o PMOS AI 4.0
  let currentAttachment = null;

  function pmosAiReadFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = () => resolve(reader.result || "");
      reader.readAsText(file);
    });
  }

  function pmosAiReadFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = () => resolve(reader.result || "");
      reader.readAsDataURL(file);
    });
  }

  function pmosAiExtractPdfText(file) {
    return new Promise((resolve, reject) => {
      if (!window.pdfjsLib) {
        resolve(
          `[PMOS AI] PDF anexado (${file.name}) com ${file.size} bytes. ` +
          `O texto bruto não pôde ser extraído automaticamente. ` +
          `Peça ao usuário trechos importantes se necessário.`
        );
        return;
      }

      try {
        if (window.pdfjsLib.GlobalWorkerOptions) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            window.pdfjsLib.GlobalWorkerOptions.workerSrc ||
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js";
        }
      } catch (err) {
        console.warn("Falha ao configurar worker do pdf.js", err);
      }

      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = async () => {
        try {
          const typedArray = new Uint8Array(reader.result);
          const loadingTask = window.pdfjsLib.getDocument({ data: typedArray });
          loadingTask.promise
            .then(async (pdf) => {
              let fullText = "";
              const maxPages = Math.min(pdf.numPages, 30);
              for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const content = await page.getTextContent();
                const strings = content.items.map((it) => it.str || "").join(" ");
                fullText += "\n\n" + strings;
              }
              resolve(
                fullText ||
                `[PMOS AI] PDF (${file.name}) lido, mas não foi possível extrair texto.`
              );
            })
            .catch((err) => {
              console.error("Erro ao carregar PDF:", err);
              resolve(
                `[PMOS AI] Erro ao ler o PDF (${file.name}). Tamanho: ${file.size} bytes.`
              );
            });
        } catch (err) {
          console.error("Erro geral ao processar PDF:", err);
          resolve(`[PMOS AI] Erro ao processar o PDF (${file.name}).`);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }



  function ensureUI() {
    if (document.getElementById("pmos-ai-root")) return;
    const toggle = document.createElement("button");
    toggle.id = "pmos-ai-toggle"; toggle.title = "PMOS AI (Ctrl+.)"; toggle.textContent = "🤖";
    document.body.appendChild(toggle);
    const root = document.createElement("div");
    root.id = "pmos-ai-root"; root.setAttribute("data-open", "false");
    root.innerHTML = `
      <div class="pmos-ai-header">
        <div class="pmos-ai-title">PMOS AI 4.0</div>
        <div class="pmos-ai-badges">
          <span class="pmos-badge">Gemini</span>
          <span class="pmos-badge" id="pmos-ai-dryrun">Dry‑run</span>
        </div>
      </div>
      <div class="pmos-ai-toolbar">
        <button data-quick="explainErrors">Explicar erro do console</button>
        <button data-quick="okr">Gerar OKRs</button>
        <button data-quick="backlog">Criar backlog</button>
        <button data-quick="release">Plano de release</button>
        <button data-quick="seed">Seed demo</button>
      </div>
      
      <div class="pmos-ai-upload">
        <label class="pmos-ai-upload-label">
          <span>Anexar PDF / imagem / texto</span>
          <input type="file" id="pmos-ai-file" class="pmos-ai-file-input" accept=".pdf,image/*,text/plain,.md,.doc,.docx" />
        </label>
        <div id="pmos-ai-file-name" class="pmos-ai-file-name text-xs text-slate-400">
          Nenhum arquivo anexado.
        </div>
      </div>

      <div class="pmos-ai-body">
        <div class="pmos-ai-messages" id="pmos-ai-messages"></div>
        <div class="pmos-ai-input">
          <textarea id="pmos-ai-input" placeholder="Peça algo como: 'crie uma tarefa de orçamento para novembro, R$ 8.000, responsável Camila, prazo 15/11'"></textarea>
          <button id="pmos-ai-send">Enviar</button>
        </div>
        <div class="pmos-ai-footer">Atalho: Ctrl+. • Log: PMOS_AI_LOG</div>
      </div>`;
    document.body.appendChild(root);

    const fileInput = root.querySelector("#pmos-ai-file");
    const fileNameEl = root.querySelector("#pmos-ai-file-name");

    if (fileInput) {
      fileInput.addEventListener("change", async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) {
          currentAttachment = null;
          if (fileNameEl) fileNameEl.textContent = "Nenhum arquivo anexado.";
          return;
        }
        if (fileNameEl) fileNameEl.textContent = `Anexado: ${file.name}`;

        try {
          let fileContent = "";
          let fileKind = "upload";

          if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            fileKind = "pdf-text";
            fileContent = await pmosAiExtractPdfText(file);
          } else if (file.type && file.type.startsWith("image/")) {
            fileKind = "image-dataurl";
            fileContent = await pmosAiReadFileAsDataURL(file);
          } else {
            fileKind = "text-file";
            fileContent = await pmosAiReadFileAsText(file);
          }

          currentAttachment = {
            fileContent,
            fileName: file.name,
            fileType: file.type || "",
            fileKind
          };
        } catch (err) {
          console.error("Erro ao ler arquivo anexado:", err);
          currentAttachment = {
            fileContent: `[PMOS AI] Houve um erro ao ler o arquivo ${file.name}. Use apenas o que estiver no contexto visível.`,
            fileName: file.name,
            fileType: file.type || "",
            fileKind: "erro-leitura"
          };
        }
      });
    }


    toggle.addEventListener("click", () => { STATE.open = !STATE.open; root.setAttribute("data-open", STATE.open ? "true" : "false"); });
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === ".") { e.preventDefault(); toggle.click(); } });
    root.querySelector("#pmos-ai-dryrun").addEventListener("click", () => {
      STATE.dryRun = !STATE.dryRun;
      root.querySelector("#pmos-ai-dryrun").textContent = STATE.dryRun ? "Dry‑run ON" : "Dry‑run";
    });
    root.querySelector("#pmos-ai-send").addEventListener("click", onSend);
    root.querySelector("#pmos-ai-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } });
    root.querySelectorAll(".pmos-ai-toolbar button").forEach(btn => btn.addEventListener("click", () => quickAction(btn.dataset.quick)));
  }

  function pushMsg(role, content) {
    const box = document.getElementById("pmos-ai-messages");
    const div = document.createElement("div");
    div.className = "pmos-msg " + (role === "assistant" ? "assistant" : "user");
    div.textContent = content;
    box.appendChild(div); box.scrollTop = box.scrollHeight;
  }

  async function callAI(prompt, extra = {}) {
    const {
      appType = "pmos-global",
      fileContent,
      fileName,
      fileType,
      fileKind
    } = extra || {};

    const body = {
      prompt,
      systemInstruction: `Você é o PMOS AI 4.0, um agente que:
- Entende comandos em PT-BR.
- Quando for executar ação, responda EM JSON:
{"action":"<nome_da_acao>","args":{...},"confirm":false,"explain":"<resumo>"}
- Para múltiplas ações, responda um array desses objetos.
- Catálogo de Ações:
  - openApp({ appName: "kanban" | "swot" | "checklist" | "5w2h" | ... })
  - kanbanAddColumn({ title })
  - kanbanAddCard({ columnTitle, cardTitle, description, priority })
  - swotUpdate({ quadrant: "forças"|"fraquezas"|"oportunidades"|"ameaças", text })
  - addQualityToolItem({ toolType: "checklist"|"5w2h", itemData: {...} })
      - Para checklist: itemData = { text, status, responsible }
      - Para 5w2h: itemData = { what, why, where, when, who, how, howMuch, status }
  - createTask, updateTask, setDeadline, changeStatus, assignUser
  - addBudgetEntry, addTransaction, createOKR, updateOKR
  - explainConsoleError, seedDemo
- Se for apenas conversa, responda texto normal.`,
      appType,
      uiLocale: navigator.language || "pt-BR"
    };

    if (fileContent) {
      body.fileContent = fileContent;
      body.fileName = fileName || "arquivo";
      body.fileType = fileType || "";
      body.fileKind = fileKind || "upload";
    }

    const resp = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    let text = "";
    try {
      text =
        data.text ||
        (data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text) ||
        JSON.stringify(data);
    } catch (err) {
      console.error("Erro ao interpretar resposta da IA:", err);
      text = JSON.stringify(data);
    }
    return text;
  }
  function normalizeAIOutput(text) {
    try { return JSON.parse(text); } catch { }
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) { try { return JSON.parse(m[1]); } catch { } }
    return text;
  }
  function logAction(entry) { console.log("[PMOS_AI_LOG]", entry); }

  // Helper para encontrar instância de app aberta
  function getAppInstance(appType) {
    if (!window.windowManager || !window.windowManager.windows) return null;
    for (const [id, win] of window.windowManager.windows) {
      if (win.appType && win.appType.includes(appType) && win.currentAppInstance) {
        return win.currentAppInstance;
      }
    }
    return null;
  }

  const PMOSActionAPI = {
    openApp: ({ appName }) => {
      const map = {
        "kanban": "open-kanban-board",
        "swot": "open-swot-analysis",
        "checklist": "open-checklist-tool",
        "5w2h": "open-5w2h-tool",
        "gantt": "open-gantt-chart",
        "ishikawa": "open-ishikawa-diagram",
        "pdca": "open-pdca-tool",
        "ncr": "open-ncr-tool",
        "project": "open-project-tasks",
        "files": "open-file-system"
      };
      const action = map[appName.toLowerCase()] || map[Object.keys(map).find(k => appName.toLowerCase().includes(k))];

      if (action && window.windowManager && window.windowManager.appLaunchActions[action]) {
        window.windowManager.appLaunchActions[action]();
        return { ok: true, opened: appName };
      }
      return { ok: false, reason: "app-not-found", appName };
    },

    kanbanAddColumn: ({ title }) => {
      const app = getAppInstance("kanban-board");
      if (!app) return { ok: false, reason: "kanban-not-open" };

      app.boardData.columns.push({ id: "col_" + Date.now(), title, cards: [] });
      app.markDirty();
      app.renderBoard();
      return { ok: true, column: title };
    },

    kanbanAddCard: ({ columnTitle, cardTitle, description, priority = "medium" }) => {
      const app = getAppInstance("kanban-board");
      if (!app) return { ok: false, reason: "kanban-not-open" };

      const col = app.boardData.columns.find(c => c.title.toLowerCase().includes(columnTitle.toLowerCase()));
      if (!col) return { ok: false, reason: "column-not-found", columnTitle };

      col.cards.push({
        id: "card_" + Date.now(),
        title: cardTitle,
        description: description || "",
        priority,
        dueDate: "",
        assignee: "",
        tags: []
      });
      app.markDirty();
      app.renderBoard();
      return { ok: true, card: cardTitle, column: col.title };
    },

    swotUpdate: ({ quadrant, text, append = true }) => {
      const app = getAppInstance("swot-analysis");
      if (!app) return { ok: false, reason: "swot-not-open" };

      const map = {
        "forças": "strengthsEl", "strengths": "strengthsEl",
        "fraquezas": "weaknessesEl", "weaknesses": "weaknessesEl",
        "oportunidades": "opportunitiesEl", "opportunities": "opportunitiesEl",
        "ameaças": "threatsEl", "threats": "threatsEl"
      };

      const fieldName = map[quadrant.toLowerCase()];
      if (!fieldName || !app[fieldName]) return { ok: false, reason: "quadrant-invalid", quadrant };

      const el = app[fieldName];
      if (append && el.value) {
        el.value += "\n- " + text;
      } else {
        el.value = "- " + text;
      }
      app.markDirty();
      return { ok: true, quadrant };
    },

    addQualityToolItem: ({ toolType, itemData }) => {
      // toolType: 'checklist', '5w2h', 'pdca', 'ncr'
      const app = getAppInstance(toolType); // busca parcial, ex: 'quality-tool checklist'
      if (!app) return { ok: false, reason: `${toolType}-not-open` };

      if (app.items) {
        app.items.push({ ...itemData, id: "ai_" + Date.now() });
        app.markDirty();
        app.renderList();
        return { ok: true, tool: toolType, item: itemData };
      }
      return { ok: false, reason: "not-supported-or-error" };
    },

    createTask: ({ title, description = "", assignee = "", deadline = "", status = "Pendente", listSelector = ".task-list" }) => {
      const list = document.querySelector(listSelector) || document.querySelector("#tasks, .tasks, [data-role='tasks']");
      const item = document.createElement("div");
      item.className = "task-item ai-created";
      item.innerHTML = `<strong>${title || "(sem título)"}</strong><br><small>${description}</small><br><em>${assignee}</em> • prazo ${deadline} • ${status}`;
      (list || document.body).appendChild(item);
      return { ok: true, title };
    },
    updateTask: ({ title, newTitle, description, status }) => {
      const items = Array.from(document.querySelectorAll(".task-item, [data-task]"));
      const found = items.find(el => (el.textContent || "").toLowerCase().includes((title || "").toLowerCase()));
      if (found) {
        if (newTitle) found.querySelector("strong")?.innerText = newTitle;
        if (description) found.querySelector("small")?.innerText = description;
        if (status) found.setAttribute("data-status", status);
        return { ok: true, updated: true };
      }
      return { ok: false, reason: "not-found" };
    },
    setDeadline: ({ title, deadline }) => {
      const items = Array.from(document.querySelectorAll(".task-item, [data-task]"));
      const found = items.find(el => (el.textContent || "").toLowerCase().includes((title || "").toLowerCase()));
      if (found) {
        const em = found.querySelector("em") || document.createElement("em");
        em.textContent = `prazo ${deadline}`;
        if (!found.querySelector("em")) found.appendChild(em);
        return { ok: true };
      }
      return { ok: false };
    },
    changeStatus: ({ title, status }) => {
      const items = Array.from(document.querySelectorAll(".task-item, [data-task]"));
      const found = items.find(el => (el.textContent || "").toLowerCase().includes((title || "").toLowerCase()));
      if (found) { found.setAttribute("data-status", status); return { ok: true }; }
      return { ok: false };
    },
    assignUser: ({ title, assignee }) => {
      const items = Array.from(document.querySelectorAll(".task-item, [data-task]"));
      const found = items.find(el => (el.textContent || "").toLowerCase().includes((title || "").toLowerCase()));
      if (found) {
        let small = found.querySelector("small"); if (!small) { small = document.createElement("small"); found.appendChild(small); }
        small.textContent = assignee; return { ok: true };
      }
      return { ok: false };
    },
    addBudgetEntry: ({ month, amount, category = "Geral" }) => {
      const key = "pmos_ai_budget";
      const data = JSON.parse(localStorage.getItem(key) || "{}");
      data[month] = data[month] || [];
      data[month].push({ amount, category, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(data));
      return { ok: true, saved: true };
    },
    addTransaction: ({ date, value, kind = "despesa", category = "Geral", description = "" }) => {
      const key = "pmos_ai_tx";
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      data.push({ date, value, kind, category, description, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(data));
      return { ok: true, saved: true };
    },
    createOKR: ({ objective, keyResults = [] }) => {
      const key = "pmos_ai_okrs";
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      data.push({ objective, keyResults, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(data));
      return { ok: true, count: data.length };
    },
    updateOKR: ({ index = 0, objective, keyResults }) => {
      const key = "pmos_ai_okrs";
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      if (data[index]) {
        if (objective) data[index].objective = objective;
        if (keyResults) data[index].keyResults = keyResults;
        localStorage.setItem(key, JSON.stringify(data));
        return { ok: true };
      }
      return { ok: false };
    },
    explainConsoleError: () => {
      const errors = (window.__PMOS_CONSOLE_ERRORS__ || []);
      if (errors.length === 0) return { ok: true, message: "Sem erros capturados nesta sessão." };
      return { ok: true, errors };
    },
    seedDemo: () => {
      PMOSActionAPI.createTask({ title: "Planejamento Orçamentário Novembro", description: "Definir teto de gastos por diretoria", assignee: "Camila", deadline: "15/11", status: "Em andamento" });
      PMOSActionAPI.addBudgetEntry({ month: "2025-11", amount: 8000, category: "TI" });
      PMOSActionAPI.createOKR({ objective: "Reduzir prazos de licenciamento em 20%", keyResults: ["Automatizar 3 fluxos", "Publicar painel de métricas", "Treinar 50 servidores"] });
      return { ok: true };
    },
    navigate: ({ selector }) => {
      const el = document.querySelector(selector);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.click?.(); return { ok: true }; }
      return { ok: false, reason: "element-not-found", selector };
    },
    click: ({ selector }) => {
      const el = document.querySelector(selector);
      if (el) { el.click(); return { ok: true }; }
      return { ok: false, reason: "element-not-found", selector };
    },
    fillForm: ({ selector, value }) => {
      const el = document.querySelector(selector);
      if (el) { el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); return { ok: true }; }
      return { ok: false, reason: "element-not-found", selector };
    },
    setValue: ({ selector, value }) => PMOSActionAPI.fillForm({ selector, value })
  };

  (function interceptConsole() {
    const origError = console.error;
    window.__PMOS_CONSOLE_ERRORS__ = [];
    console.error = function (...args) { try { window.__PMOS_CONSOLE_ERRORS__.push(args.map(String).join(" ")); } catch { }; return origError.apply(console, args); };
  })();

  async function onSend() {
    const input = document.getElementById("pmos-ai-input");
    const prompt = input.value.trim(); if (!prompt) return;
    pushMsg("user", prompt); input.value = "";
    try {
      const raw = await callAI(
        prompt,
        currentAttachment
          ? { appType: "pmos-global", ...currentAttachment }
          : { appType: "pmos-global" }
      );
      const out = normalizeAIOutput(raw);
      if (typeof out === "string") { pushMsg("assistant", out); return; }
      const actions = Array.isArray(out) ? out : [out];
      const results = [];
      for (const act of actions) {
        const { action, args = {}, confirm = false, explain = "" } = act || {};
        if (!action) continue;
        if (confirm || STATE.dryRun) { results.push({ action, args, confirm: true, explain: explain || "Confirme para executar." }); continue; }
        if (typeof PMOSActionAPI[action] === "function") {
          const r = PMOSActionAPI[action](args); console.log("[PMOS_AI_LOG]", { action, args, result: r });
          results.push({ action, args, result: r, explain });
        } else {
          results.push({ action, args, error: "ação desconhecida" });
        }
      }
      pushMsg("assistant", "Resultado das ações: " + JSON.stringify(results, null, 2));
    } catch (e) {
      pushMsg("assistant", "Erro ao chamar IA: " + (e?.message || String(e)));
    }
  }

  async function quickAction(mode) {
    if (mode === "explainErrors") {
      const data = PMOSActionAPI.explainConsoleError();
      const raw = await callAI(`Explique estes erros de console e dê passos de correção: ${JSON.stringify(data)}`);
      pushMsg("assistant", raw); return;
    }
    if (mode === "okr") {
      const raw = await callAI("Crie OKRs trimestrais para melhorar eficiência do licenciamento sanitário (3 objetivos, 3-4 KRs cada). Responda em JSON para createOKR, com confirm=true.");
      pushMsg("assistant", raw); return;
    }
    if (mode === "backlog") {
      const raw = await callAI("Gere backlog priorizado (até 8 itens) para PMOS: orçamento, integrações API, UX. Responda em JSON com createTask (confirm=true).");
      pushMsg("assistant", raw); return;
    }
    if (mode === "release") {
      const raw = await callAI("Escreva plano de release enxuto (itens, riscos, métricas). Linguagem executiva, PT-BR.");
      pushMsg("assistant", raw); return;
    }
    if (mode === "seed") {
      const r = PMOSActionAPI.seedDemo();
      pushMsg("assistant", "Seed executado: " + JSON.stringify(r)); return;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureUI); else ensureUI();
})();
