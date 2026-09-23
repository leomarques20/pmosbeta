import { showNotification } from '../main.js';

/**
 * Retorna o HTML padrão da barra de ferramentas para os aplicativos.
 */
export function getStandardAppToolbarHTML() {
    /**
     * Barra de ferramentas padrão dos aplicativos do PMOS.
     * Agora inclui a integração com IA (Sugestões AI 4.0).
     */
    return `
        <button data-action="save" class="app-button cloud-required" title="Salvar na nuvem">
            <i class="fas fa-save"></i>
            <span>Salvar</span>
        </button>
        <button data-action="export-json" class="app-button secondary" title="Exportar como JSON">
            <i class="fas fa-file-export"></i>
            <span>Exportar</span>
        </button>
        <button data-action="open" class="app-button secondary cloud-required" title="Abrir arquivo salvo na nuvem">
            <i class="fas fa-folder-open"></i>
            <span>Abrir</span>
        </button>
        <button data-action="import-json" class="app-button secondary" title="Importar JSON do computador">
            <i class="fas fa-file-import"></i>
            <span>Importar</span>
        </button>
        <button data-action="ai-suggestions" class="app-button ai-button" title="O que o PMOS pode fazer por você aqui?">
            <span class="ai-icon">💡</span>
            <span class="ai-label">Sugestões AI</span>
        </button>
    `;
}



/**
 * Inicializa o estado de um novo arquivo para um aplicativo.
 * @param {object} appState - O objeto de estado do aplicativo.
 * @param {string} defaultTitle - O título padrão da janela.
 * @param {string} defaultFileName - O nome de arquivo padrão para salvar.
 * @param {string} appDataType - O tipo de dados do aplicativo.
 */
export function initializeFileState(appState, defaultTitle, defaultFileName, appDataType) {
    appState.isDirty = false;
    appState.fileId = null;
    appState.defaultFileName = defaultFileName;
    appState.appDataType = appDataType;

    appState.markDirty = function () {
        if (!this.isDirty) {
            this.isDirty = true;
            const currentWin = window.windowManager.windows.get(this.winId);
            if (currentWin && !currentWin.title.startsWith('*')) {
                window.windowManager.updateWindowTitle(this.winId, '*' + currentWin.title);
            }
        }
    };

    appState.markClean = function () {
        this.isDirty = false;
        const currentWin = window.windowManager.windows.get(this.winId);
        if (currentWin && currentWin.title.startsWith('*')) {
            window.windowManager.updateWindowTitle(this.winId, currentWin.title.substring(1));
        }
    };

    window.windowManager.updateWindowTitle(appState.winId, defaultTitle);
}

/**
 * Configura as ações da barra de ferramentas para um aplicativo.
 * @param {object} appState - O objeto de estado do aplicativo.
 */
export function setupAppToolbarActions(appState) {
    const winData = window.windowManager.windows.get(appState.winId);
    if (!winData) return;
    const toolbar = winData.element.querySelector('.app-toolbar');
    if (!toolbar) return;

    // Evita registrar o mesmo listener várias vezes (ex.: init() chamado de novo);
    // o estado mais recente é sempre usado.
    toolbar._pmosAppState = appState;
    if (toolbar.dataset.toolbarWired) return;
    toolbar.dataset.toolbarWired = '1';

    toolbar.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        appState = toolbar._pmosAppState || appState;

        // Ação de salvar: requer login na nuvem
        if (action === 'save') {
            if (!window.firestoreManager) {
                showNotification("Faça login para salvar na nuvem.", 2500);
                if (window.authManager && window.authManager.openLoginModal) {
                    window.authManager.openLoginModal();
                }
                return;
            }
            await handleSaveAction(appState);
        }
        // Ação abrir: listar arquivos salvos na nuvem
        else if (action === 'open') {
            if (!window.firestoreManager) {
                showNotification("Faça login para abrir da nuvem.", 2500);
                if (window.authManager && window.authManager.openLoginModal) {
                    window.authManager.openLoginModal();
                }
                return;
            }
            await openFileForApp();
        }
        // Exportar JSON localmente
        else if (action === 'export-json') {
            handleExportToJSON(appState);
        }
        // Importar JSON localmente
        else if (action === 'import-json') {
            handleImportFromJSON(appState);
        }
        // Sugestões AI contextuais por aplicativo
        else if (action === 'ai-suggestions') {
            await handleAISuggestionsForApp(appState, button);
        }
        // PDF action foi removida – nada aqui.
    });
}



/**
 * Salva o estado atual do aplicativo. Se já tiver um fileId, salva sobre o mesmo arquivo.
 * @param {object} appState - O objeto de estado do aplicativo.
 */
export async function handleSaveAction(appState) {
    if (!window.firestoreManager) {
        showNotification("Acesso à nuvem não está pronto.", 3000);
        return;
    }
    if (!appState || typeof appState.getData !== 'function') return;
    const winData = window.windowManager.windows.get(appState.winId);
    if (!winData) return;
    if (appState.fileId) {
        showNotification(`Salvando "${winData.title.replace('*', '').trim()}"...`, 2000);
        try {
            const dataToSave = appState.getData();
            const jsonString = JSON.stringify(dataToSave, null, 2);
            const fileMetadata = {
                fileId: appState.fileId,
                name: winData.title.replace('*', '').trim(),
                appDataType: appState.appDataType
            };

            await window.firestoreManager.saveFile(fileMetadata, jsonString);
            appState.markClean();
            showNotification(`"${fileMetadata.name}" salvo na nuvem.`, 2500);
        } catch (e) {
            console.error("Erro ao salvar:", e);
            showNotification("Falha ao salvar. Verifique o console.", 4000);
        }
    } else {
        await handleSaveAsAction(appState);
    }
}

/**
 * Salva o estado atual do aplicativo como um novo arquivo.
 * @param {object} appState - O objeto de estado do aplicativo.
 */
export async function handleSaveAsAction(appState) {
    if (!window.firestoreManager) {
        showNotification("Acesso à nuvem não está pronto.", 3000);
        return;
    }
    const dataToSave = appState.getData();
    const defaultFilename = (appState.fileId && window.windowManager.windows.get(appState.winId)?.title) ?
        window.windowManager.windows.get(appState.winId).title.replace('*', '').trim() : appState.defaultFileName;

    let newFilename = prompt("Salvar arquivo na nuvem como:", defaultFilename);
    if (!newFilename || newFilename.trim() === '') return;
    newFilename = newFilename.trim();

    showNotification(`Salvando "${newFilename}"...`, 2000);
    try {
        const jsonString = JSON.stringify(dataToSave, null, 2);
        const fileMetadata = {
            fileId: null, // Null indica um novo arquivo
            name: newFilename,
            appDataType: appState.appDataType
        };

        const savedFile = await window.firestoreManager.saveFile(fileMetadata, jsonString);

        appState.fileId = savedFile.id;
        appState.markClean();
        window.windowManager.updateWindowTitle(appState.winId, savedFile.name);
        showNotification(`Arquivo salvo como "${savedFile.name}" na nuvem.`, 3000);

    } catch (e) {
        console.error("Erro ao salvar:", e);
        showNotification("Falha ao salvar. Verifique o console.", 4000);
    }
}

/**
 * Exporta o conteúdo da janela ativa para PDF.
 * @param {string} winId - O ID da janela a ser exportada.
 */
export function handleExportToPDF(winId) {
    /**
     * Exporta o conteúdo da janela para impressão/PDF utilizando o modo de
     * impressão do navegador. Esse método aplica classes de impressão para
     * ocultar elementos desnecessários, expande a área do conteúdo e então
     * chama window.print(). O usuário pode então escolher "Salvar como PDF"
     * na caixa de diálogo de impressão do navegador.
     */
    const winData = window.windowManager.windows.get(winId);
    if (!winData) {
        showNotification("Janela não encontrada para exportação.", 3000);
        return;
    }
    const winEl = winData.element;
    const contentEl = winEl.querySelector('.window-content');
    if (!contentEl) {
        showNotification("Conteúdo da janela não encontrado para exportação.", 3000);
        return;
    }
    // Encontra o contêiner principal do aplicativo se existir
    let elementToPrint = contentEl.querySelector('[class*="-app-container"]') || contentEl;
    const titleEl = winEl.querySelector('.window-title-text');
    const originalTitle = document.title;
    // Define o título temporariamente para o nome da janela
    document.title = titleEl ? titleEl.textContent.replace('*', '') : 'Exportação PMOS';
    document.body.classList.add('printing-mode');
    // Aplica classe de impressão ao elemento selecionado
    elementToPrint.classList.add('window-to-print');
    showNotification("Preparando para exportação. Use 'Salvar como PDF' na caixa de impressão.", 4000);
    setTimeout(() => {
        window.print();
        const cleanupPrintStyles = () => {
            document.body.classList.remove('printing-mode');
            elementToPrint.classList.remove('window-to-print');
            document.title = originalTitle;
            window.onafterprint = null;
        };
        if (window.onafterprint !== undefined) {
            window.onafterprint = cleanupPrintStyles;
        } else {
            setTimeout(cleanupPrintStyles, 500);
        }
    }, 250);
}

/**
 * Exporta os dados atuais do aplicativo no formato JSON e inicia o download.
 * @param {object} appState - O objeto de estado do aplicativo.
 */
export function handleExportToJSON(appState) {
    try {
        const data = typeof appState.getData === 'function' ? appState.getData() : null;
        const jsonString = JSON.stringify(data, null, 2);
        // Determina um nome de arquivo baseado no título da janela ou padrão
        const winData = window.windowManager.windows.get(appState.winId);
        let baseName = 'export';
        if (winData && winData.title) {
            baseName = winData.title.replace('*', '').trim().replace(/\s+/g, '_').toLowerCase();
        } else if (appState.defaultFileName) {
            baseName = appState.defaultFileName.replace(/\..*/, '').replace(/\s+/g, '_').toLowerCase();
        }
        const filename = `${baseName || 'arquivo'}.json`;
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification(`Arquivo JSON exportado: ${filename}`, 3000);
    } catch (e) {
        console.error('Erro ao exportar JSON:', e);
        showNotification('Falha ao exportar JSON.', 4000);
    }
}

/**
 * Permite importar dados de um arquivo JSON e carregá-los no aplicativo atual.
 * @param {object} appState - O objeto de estado do aplicativo.
 */
export function handleImportFromJSON(appState) {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        input.onchange = (ev) => {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    if (typeof appState.loadData === 'function') {
                        appState.loadData(content, { id: null, name: file.name });
                        showNotification(`Arquivo importado: ${file.name}`, 3000);
                    } else {
                        showNotification('Importação não suportada para este aplicativo.', 4000);
                    }
                } catch (err) {
                    console.error('Erro ao importar JSON:', err);
                    showNotification('Falha ao importar arquivo.', 4000);
                }
            };
            reader.onerror = () => {
                showNotification('Falha ao ler arquivo.', 4000);
            };
            reader.readAsText(file);
        };
        // Anexa e clica para abrir o seletor de arquivo
        document.body.appendChild(input);
        input.click();
        // Remover o input do DOM após usar
        document.body.removeChild(input);
    } catch (e) {
        console.error('Erro ao iniciar importação de JSON:', e);
        showNotification('Falha ao iniciar importação.', 4000);
    }
}


/**
 * Abre o explorador de arquivos para o usuário selecionar um arquivo para abrir.
 */
export function openFileForApp() {
    // Reutiliza a janela do explorador se já estiver aberta
    let fsWin = Array.from(window.windowManager.windows.values()).find(w => w.appType === 'filesystem');
    if (fsWin) {
        if (fsWin.minimized) window.windowManager.restoreWindow(fsWin.element.id);
        else window.windowManager.makeActive(fsWin.element.id);
        return;
    }
    // Se não, abre uma nova
    window.windowManager.appLaunchActions['open-file-system']();
}

// =========================
// IA 4.0 – Assistente contextual do PMOS
// =========================

/**
 * Define os "modos rápidos" de IA por tipo de aplicativo.
 * Cada modo adiciona uma instrução extra ao prompt.
 */
function getAIQuickModesForApp(appState) {
    const type = appState.appDataType || '';
    /** @type {{id:string,label:string,extra:string}[]} */
    const common = [
        { id: 'prioridade', label: 'Foco imediato', extra: 'Priorize de forma objetiva o que o usuário deve fazer primeiro, considerando urgência e impacto, sempre em contexto de gestão pública.' },
        { id: 'planejar-dia', label: 'Plano do dia', extra: 'Monte um mini plano de ação para o dia de trabalho do usuário, com 3 a 7 passos claros e executáveis.' }
    ];

    const map = {
        'kanban-board': [
            { id: 'kanban-priorizar', label: 'Organizar Kanban', extra: 'Analise as colunas do Kanban (A Fazer, Em Andamento, Concluído, etc.). Foque em tarefas que não estão concluídas, sugerindo quais mover, priorizar, delegar ou adiar.' },
            { id: 'kanban-delegar', label: 'Delegar / simplificar', extra: 'Sugira quais tarefas podem ser delegadas, agrupadas ou simplificadas, e como isso reduz a carga cognitiva do usuário.' },
            { id: 'kanban-progresso', label: 'Resumo de progresso', extra: 'Descreva brevemente a situação atual do quadro Kanban, destacando vitórias recentes e próximos passos naturais.' },
            ...common
        ],
        'gantt-chart': [
            { id: 'gantt-prazos', label: 'Ajustar prazos', extra: 'Sugira ajustes de prazos e marcos no cronograma Gantt, identificando riscos de atraso e caminhos críticos.' },
            { id: 'gantt-riscos', label: 'Riscos do cronograma', extra: 'Liste riscos de cronograma (atrasos, gargalos) e ações concretas para mitigá-los.' },
            ...common
        ],
        'bpmn-modeler': [
            { id: 'bpmn-melhoria', label: 'Melhorar processo', extra: 'Sugira melhorias de fluxo BPMN, remoção de etapas redundantes e criação de eventos de exceção para reduzir retrabalho.' },
            { id: 'bpmn-controle', label: 'Controles / checkpoints', extra: 'Indique pontos do processo em que valem a pena inserir controles, registros de auditoria ou automações.' },
            ...common
        ],
        'swot-analysis': [
            { id: 'swot-ameacas', label: 'Ameaças e riscos', extra: 'Com base nas forças, fraquezas e oportunidades já cadastradas, proponha ameaças realistas para o contexto público do usuário.' },
            { id: 'swot-estrategias', label: 'Estratégias práticas', extra: 'Transforme o quadro SWOT em 3 a 5 estratégias práticas, cada uma ligada a combinações de Forças/Oportunidades ou Fraquezas/Ameaças.' },
            ...common
        ],
        'okr-tracker': [
            { id: 'okr-refinar', label: 'Refinar OKRs', extra: 'Sugira ajustes nas formulações de Objetivos e Key Results para ficarem mais claros, mensuráveis e alinhados com impacto público.' },
            { id: 'okr-iniciativas', label: 'Iniciativas-chave', extra: 'Liste iniciativas concretas que podem impulsionar o alcance dos OKRs cadastrados.' },
            ...common
        ],
        'project-tasks': [
            { id: 'tarefas-priorizar', label: 'Organizar tarefas', extra: 'Organize as tarefas em ondas de execução (agora, em breve, depois) e aponte dependências críticas.' },
            { id: 'tarefas-delegar', label: 'Delegar tarefas', extra: 'Sugira tarefas que podem ser delegadas a outras pessoas ou setores, com justificativas.' },
            ...common
        ]
    };

    return map[type] || common;
}

/**
 * Retorna o modo rápido atualmente selecionado no container.
 */
function getActiveAIQuickMode(appState, container) {
    if (!container) {
        const fallbackModes = getAIQuickModesForApp(appState);
        return fallbackModes[0] || { id: 'default', label: 'Sugestões gerais', extra: '' };
    }
    const activeBtn = container.querySelector('.ai-mode-chip.is-active') || container.querySelector('.ai-mode-chip');
    if (!activeBtn) {
        const fallbackModes = getAIQuickModesForApp(appState);
        return fallbackModes[0] || { id: 'default', label: 'Sugestões gerais', extra: '' };
    }
    return {
        id: activeBtn.dataset.aiMode || 'custom',
        label: activeBtn.textContent.trim(),
        extra: activeBtn.dataset.aiModeExtra || ''
    };
}

/**
 * Garante que o container de IA exista na janela e devolve refs
 * para status, corpo e elementos de chat.
 */
function ensureAISuggestionsContainer(appState) {
    const winData = window.windowManager.windows.get(appState.winId);
    if (!winData) return null;
    const contentEl = winData.element.querySelector('.window-content');
    if (!contentEl) return null;

    let container = contentEl.querySelector('.ai-suggestions-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'ai-suggestions-container';

        const modes = getAIQuickModesForApp(appState);
        const modesHtml = modes.map((mode, index) => {
            const safeExtra = (mode.extra || '').replace(/"/g, '&quot;');
            return `
                <button type="button"
                    class="ai-mode-chip ${index === 0 ? 'is-active' : ''}"
                    data-ai-mode="${mode.id}"
                    data-ai-mode-extra="${safeExtra}">
                    ${mode.label}
                </button>
            `;
        }).join('');

        container.innerHTML = `
            <div class="ai-suggestions-header">
                <div class="ai-suggestions-header-main">
                    <div class="ai-suggestions-header-title">
                        <span class="ai-logo">💡</span>
                        <span>Sugestões AI — PMOS</span>
                    </div>
                    <div class="ai-suggestions-header-subtitle">
                        O que o PMOS pode fazer por você aqui?
                    </div>
                </div>
                <button type="button" class="ai-suggestions-close" aria-label="Fechar sugestões AI">×</button>
            </div>
            <div class="ai-suggestions-modes">
                ${modesHtml}
            </div>
            <div class="ai-suggestions-status"></div>
            <div class="ai-suggestions-body"></div>
            <div class="ai-chat-panel">
                <div class="ai-chat-title">Chat com o PMOS neste app</div>
                <div class="ai-chat-history"></div>
                <div class="ai-chat-input-row">
                    <input type="text" class="ai-chat-input" placeholder="Pergunte ao PMOS sobre este quadro, processo ou tarefas..." />
                    <button type="button" class="ai-chat-send-button" data-ai-action="chat-send">Enviar</button>
                </div>
            </div>
        `;
        // insere logo abaixo da toolbar
        const toolbar = contentEl.querySelector('.app-toolbar');
        if (toolbar && toolbar.parentElement) {
            toolbar.insertAdjacentElement('afterend', container);
        } else {
            contentEl.prepend(container);
        }

        container._pmosAppState = appState;
    } else {
        container.style.display = 'block';
        container._pmosAppState = appState;
    }

    // Wire de interações só uma vez
    if (!container.dataset.wiredAi) {
        container.dataset.wiredAi = '1';

        // Troca de modos
        container.addEventListener('click', (ev) => {
            const modeBtn = ev.target.closest('.ai-mode-chip');
            if (modeBtn) {
                container.querySelectorAll('.ai-mode-chip.is-active').forEach(btn => btn.classList.remove('is-active'));
                modeBtn.classList.add('is-active');
            }

            const chatSend = ev.target.closest('[data-ai-action="chat-send"]');
            if (chatSend) {
                const input = container.querySelector('.ai-chat-input');
                if (input && input.value.trim()) {
                    handleAIChatForApp(container._pmosAppState, container, input.value.trim());
                    input.value = '';
                }
            }

            const closeBtn = ev.target.closest('.ai-suggestions-close');
            if (closeBtn) {
                container.style.display = 'none';
            }
        });

        // Enter para enviar pergunta no chat
        const chatInput = container.querySelector('.ai-chat-input');
        if (chatInput) {
            chatInput.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault();
                    const txt = chatInput.value.trim();
                    if (txt) {
                        handleAIChatForApp(container._pmosAppState, container, txt);
                        chatInput.value = '';
                    }
                }
            });
        }
    }

    const statusEl = container.querySelector('.ai-suggestions-status');
    const bodyEl = container.querySelector('.ai-suggestions-body');
    const chatHistoryEl = container.querySelector('.ai-chat-history');

    return { container, statusEl, bodyEl, chatHistoryEl };
}

/**
 * Limpa lixo de Markdown / blocos de código e garante HTML simples.
 */
const AI_ALLOWED_TAGS = new Set(['P', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'H3', 'H4', 'BR']);

/**
 * Mantém apenas tags simples de formatação e remove todos os atributos,
 * evitando injeção de scripts/handlers vindos da resposta da IA.
 */
function stripUnsafeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const walk = (node) => {
        Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                walk(child);
                if (!AI_ALLOWED_TAGS.has(child.tagName)) {
                    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'].includes(child.tagName)) {
                        child.remove();
                    } else {
                        child.replaceWith(...Array.from(child.childNodes));
                    }
                } else {
                    Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
                }
            } else if (child.nodeType !== Node.TEXT_NODE) {
                child.remove();
            }
        });
    };
    walk(template.content);
    return template.innerHTML;
}

function sanitizeAISuggestionsHtml(text) {
    return stripUnsafeHtml(formatAISuggestionsHtml(text));
}

function formatAISuggestionsHtml(text) {
    if (!text) return "";
    let cleaned = text.trim();

    // Remove blocos de código estilo ```lang ... ```
    cleaned = cleaned.replace(/```[a-zA-Z]*\s*([\s\S]*?)```/g, (match, inner) => inner.trim());

    // Remove marcador inicial "html" ou "HTML" isolado no topo
    cleaned = cleaned.replace(/^(html|HTML)\s*\n/, "");

    cleaned = cleaned.trim();

    // Se não houver tags HTML, converte quebras de linha em parágrafos simples
    if (!(/[<][a-zA-Z/]/.test(cleaned))) {
        const parts = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
            cleaned = parts
                .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
                .join("");
        } else {
            cleaned = `<p>${cleaned.replace(/\n/g, "<br>")}</p>`;
        }
    }

    return cleaned;
}

/**
 * Prompt base para Sugestões AI (botão da toolbar).
 */
function buildAISuggestionsPrompt(appState, contextData) {
    const appType = appState.appDataType || '';

    const baseByType = {
        'kanban-board': "Você está no quadro Kanban do PMOS (plataforma de gestão pública e projetos). As colunas indicam status (por exemplo: 'A Fazer', 'Em Andamento', 'Concluído'). Ajude o usuário a organizar, priorizar e simplificar as tarefas pendentes.",
        'gantt-chart': "Você está no cronograma Gantt do PMOS. Analise tarefas, datas e dependências para sugerir um plano de prazos realista, destacando riscos de atraso.",
        'bpmn-modeler': "Você está no modelador BPMN do PMOS. Analise o processo e sugira melhorias de fluxo, pontos de controle e caminhos alternativos para reduzir retrabalho.",
        'swot-analysis': "Você está em uma análise SWOT no PMOS. Com base nos dados preenchidos, proponha ameaças, estratégias e próximos passos práticos.",
        'project-tasks': "Você está na lista de tarefas de projeto do PMOS. Ajude a transformar a lista em um plano de ação priorizado, com próximos passos claros.",
        'okr-tracker': "Você está no módulo de OKRs do PMOS. Ajude a refinar objetivos e resultados-chave e sugerir iniciativas concretas.",
        'bpmn-process-summary': "Você está vendo o resumo de um processo no PMOS. Sugira pontos de melhoria e riscos operacionais.",
    };

    const base = baseByType[appType] || "Você é o assistente de IA do PMOS (plataforma de gestão pública e projetos). Analise os dados desta aplicação e sugira ações práticas para o usuário.";

    const contextHint = contextData
        ? "Use os dados JSON fornecidos apenas como referência. Foque sempre em orientar decisões e próximos passos, não em repetir o conteúdo bruto."
        : "Ainda não há dados preenchidos. Ajude o usuário a começar sugerindo como estruturar este quadro ou processo.";

    return [
        base,
        "",
        contextHint,
        "",
        "Regras gerais de resposta:",
        "- Sempre responda em português claro e direto.",
        "- Seja prático, com foco em gestão pública e execução.",
        "- Devolva a resposta como uma lista organizada de tópicos ou passos numerados.",
        "- Formate a resposta em HTML simples, usando apenas <p>, <ul>, <ol>, <li>, <strong>, <em> e <h3>, sem usar Markdown ou blocos de código.",
        "- Evite respostas genéricas demais; use ao máximo o contexto fornecido."
    ].join("\n");
}

/**
 * Prompt para o modo chat conversacional.
 */
function buildAIChatPrompt(appState, contextData, history, userQuestion, quickMode) {
    const appType = appState.appDataType || '';
    const modeLabel = quickMode && quickMode.label ? quickMode.label : 'Sugestões gerais';
    const modeExtra = quickMode && quickMode.extra ? quickMode.extra : '';

    const base = buildAISuggestionsPrompt(appState, contextData);

    const historyText = (history && history.length)
        ? history.slice(-6).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.text}`).join("\n")
        : "Ainda não houve conversa prévia.";

    return [
        base,
        "",
        `Modo selecionado: ${modeLabel}.`,
        modeExtra ? `Instrução adicional do modo: ${modeExtra}` : "",
        "",
        "Histórico recente da conversa:",
        historyText,
        "",
        "Pergunta atual do usuário:",
        userQuestion,
        "",
        "Responda de forma conversacional, em até 8 parágrafos curtos, sempre em HTML simples (parágrafos e listas)."
    ].join("\n");
}

/**
 * Chamada principal do botão "Sugestões AI" da toolbar.
 */
async function handleAISuggestionsForApp(appState, clickedButton) {
    const helpers = ensureAISuggestionsContainer(appState);
    if (!helpers) {
        showNotification("Não foi possível abrir o painel de Sugestões AI.", 2500);
        return;
    }
    const { container, statusEl, bodyEl } = helpers;

    const quickMode = getActiveAIQuickMode(appState, container);

    let originalLabel = null;
    if (clickedButton) {
        originalLabel = clickedButton.innerHTML;
        clickedButton.disabled = true;
        clickedButton.innerHTML = '<span class="ai-icon">💡</span><span class="ai-label">Gerando…</span>';
    }

    statusEl.textContent = "Gerando sugestões com a IA do PMOS…";
    bodyEl.innerHTML = "";

    let rawData = null;
    if (typeof appState.getData === 'function') {
        try {
            rawData = appState.getData();
        } catch (e) {
            console.error("Erro ao coletar dados para IA:", e);
        }
    }

    // Kanban: anexar informação de coluna em cada card e focar em pendências
    let contextForAI = rawData;
    if (appState.appDataType === 'kanban-board' && rawData && Array.isArray(rawData.columns)) {
        const filteredColumns = [];
        for (const col of rawData.columns) {
            const cards = Array.isArray(col.cards) ? col.cards.map(card => ({
                id: card.id,
                title: card.title,
                description: card.description,
                priority: card.priority,
                dueDate: card.dueDate,
                assignee: card.assignee,
                tags: card.tags,
                columnTitle: col.title
            })) : [];
            filteredColumns.push({
                title: col.title,
                cards
            });
        }
        contextForAI = {
            tags: rawData.tags || [],
            columns: filteredColumns
        };
    }

    let serialized = "";
    if (contextForAI != null) {
        try {
            serialized = JSON.stringify(contextForAI);
            const maxLen = 8000;
            if (serialized.length > maxLen) {
                serialized = serialized.slice(0, maxLen) + "\n\n(Conteúdo truncado para caber no contexto de IA.)";
            }
        } catch (e) {
            console.error("Erro ao serializar dados para IA:", e);
        }
    }

    const basePrompt = buildAISuggestionsPrompt(appState, rawData);
    const modeText = quickMode && quickMode.extra
        ? `\n\nModo rápido selecionado: ${quickMode.label}.\nInstrução adicional para este modo:\n${quickMode.extra}\n`
        : "";
    const prompt = basePrompt + modeText + (serialized ? "\n\nDados atuais (JSON):\n" + serialized : "");

    try {
        const response = await fetch('/.netlify/functions/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                appType: appState.appDataType || 'generic',
                uiLocale: 'pt-BR'
            })
        });

        if (!response.ok) {
            console.error("Falha HTTP ao chamar ai-proxy:", response.status);
            if (response.status === 404) {
                statusEl.textContent = "IA indisponível no ambiente local.";
                bodyEl.innerHTML = "<p>O serviço de IA não está disponível neste ambiente (localhost). Para usar a IA, é necessário implantar o projeto no Netlify ou rodar com `netlify dev`.</p>";
            } else {
                statusEl.textContent = "Não foi possível falar com a IA agora.";
            }
            showNotification("Falha ao obter sugestões da IA.", 3000);
            return;
        }

        const data = await response.json();
        const text = (data && typeof data.text === 'string') ? data.text.trim() : '';

        statusEl.textContent = "";
        if (text) {
            const html = sanitizeAISuggestionsHtml(text);
            bodyEl.innerHTML = html || "<p>A IA não retornou sugestões utilizáveis desta vez. Tente novamente em instantes.</p>";
        } else {
            bodyEl.innerHTML = "<p>A IA não retornou sugestões utilizáveis desta vez. Tente novamente em instantes.</p>";
        }
    } catch (err) {
        console.error("Erro ao chamar ai-proxy:", err);
        statusEl.textContent = "Erro ao falar com a IA.";
        showNotification("Erro de comunicação com a IA.", 3000);
    } finally {
        if (clickedButton && originalLabel != null) {
            clickedButton.disabled = false;
            clickedButton.innerHTML = originalLabel;
        }
    }
}

/**
 * Modo chat 1:1 com o PMOS dentro do app.
 */
async function handleAIChatForApp(appState, container, userQuestion) {
    if (!userQuestion) return;
    const helpers = ensureAISuggestionsContainer(appState);
    if (!helpers) {
        showNotification("Não foi possível abrir o painel de chat da IA.", 2500);
        return;
    }
    const { chatHistoryEl, statusEl } = helpers;

    // Histórico em memória no próprio appState
    if (!Array.isArray(appState.aiChatHistory)) {
        appState.aiChatHistory = [];
    }

    // Adiciona pergunta no histórico visual
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'ai-chat-message user';
    userMsgEl.textContent = userQuestion;
    chatHistoryEl.appendChild(userMsgEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

    appState.aiChatHistory.push({ role: 'user', text: userQuestion });

    const rawData = (typeof appState.getData === 'function') ? (() => {
        try { return appState.getData(); } catch (e) { console.error(e); return null; }
    })() : null;

    const quickMode = getActiveAIQuickMode(appState, container);
    const prompt = buildAIChatPrompt(appState, rawData, appState.aiChatHistory, userQuestion, quickMode);

    statusEl.textContent = "Conversando com o assistente do PMOS…";

    try {
        const response = await fetch('/.netlify/functions/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                appType: appState.appDataType || 'generic',
                uiLocale: 'pt-BR'
            })
        });

        if (!response.ok) {
            console.error("Falha HTTP ao chamar ai-proxy (chat):", response.status);
            if (response.status === 404) {
                statusEl.textContent = "IA indisponível no ambiente local.";
                const botMsgEl = document.createElement('div');
                botMsgEl.className = 'ai-chat-message assistant';
                botMsgEl.innerHTML = "<p>O serviço de IA não está disponível neste ambiente (localhost). Para usar a IA, é necessário implantar o projeto no Netlify ou rodar com `netlify dev`.</p>";
                chatHistoryEl.appendChild(botMsgEl);
                chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
            } else {
                statusEl.textContent = "Não foi possível falar com a IA agora.";
            }
            showNotification("Falha ao conversar com a IA.", 3000);
            return;
        }

        const data = await response.json();
        const text = (data && typeof data.text === 'string') ? data.text.trim() : '';
        const answerHtml = sanitizeAISuggestionsHtml(text || "A IA não respondeu com conteúdo utilizável desta vez.");

        // Adiciona resposta no histórico visual
        const botMsgEl = document.createElement('div');
        botMsgEl.className = 'ai-chat-message assistant';
        botMsgEl.innerHTML = answerHtml;
        chatHistoryEl.appendChild(botMsgEl);
        chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

        appState.aiChatHistory.push({ role: 'assistant', text: text });
    } catch (err) {
        console.error("Erro ao chamar ai-proxy (chat):", err);
        statusEl.textContent = "Erro ao falar com a IA.";
        showNotification("Erro de comunicação com a IA.", 3000);
    }
}

