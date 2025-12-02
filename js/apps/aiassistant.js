import { showNotification } from '../main.js';

/**
 * Abre uma janela de bate‑papo com o assistente de IA. Esta função cria
 * uma nova janela usando o WindowManager e insere uma interface simples
 * para interação com a API Gemini da Google através de uma função
 * serverless hospedada pela Netlify. O usuário pode digitar perguntas e
 * receber respostas em tempo real, enriquecendo a experiência do
 * Public Management OS com recursos de IA generativa.
 */
export function openAIAssistant() {
    // Criar uma nova janela com tamanho padrão de chat
    const winId = window.windowManager.createWindow('Assistente IA', '', {
        width: '600px',
        height: '500px',
        appType: 'ai-assistant'
    });
    const winElement = document.getElementById(winId);
    const contentEl = winElement.querySelector('.window-content');
    if (!contentEl) {
        showNotification('Falha ao inicializar a interface do assistente IA.', 3000);
        return;
    }

    // Criar contêiner da aplicação
    const container = document.createElement('div');
    container.className = 'ai-assistant-app-container';
    // Montar HTML da interface
    container.innerHTML = `
        <div class="ai-chat-display" style="height: calc(100% - 60px); overflow-y: auto; padding: 10px;">
            <p style="color: var(--text-muted); font-size: 0.9em; margin-top: 0;">Pergunte algo ao assistente...</p>
        </div>
        <div class="ai-chat-input" style="display: flex; border-top: 1px solid var(--border-color); padding: 10px;">
            <input type="text" placeholder="Digite sua pergunta..." style="flex-grow: 1; margin-right: 10px; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px;" />
            <button class="app-button" style="padding: 6px 12px;">Enviar</button>
        </div>
    `;
    contentEl.appendChild(container);
    const display = container.querySelector('.ai-chat-display');
    const input = container.querySelector('input');
    const button = container.querySelector('button');

    /**
     * Função auxiliar para enviar uma mensagem ao servidor e exibir a
     * resposta. Esta função realiza uma chamada fetch para a função
     * serverless `/.netlify/functions/ai`, que por sua vez comunica‑se
     * com a API Gemini. As respostas são adicionadas no display e a
     * área de exibição rola automaticamente para mostrar a última
     * mensagem.
     */
    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;
        // Exibir mensagem do usuário
        const userMsgEl = document.createElement('div');
        userMsgEl.className = 'ai-chat-user-message';
        userMsgEl.innerHTML = `<strong>Você:</strong> ${text}`;
        display.appendChild(userMsgEl);
        display.scrollTop = display.scrollHeight;
        // Limpar campo de entrada
        input.value = '';

        /*
         * Comandos de controle e manipulação de aplicativos:
         * Antes de encaminhar a pergunta para a API, verificamos se o
         * texto contém um comando reconhecido. Suportamos tanto a
         * abertura de aplicativos quanto tarefas específicas dentro dos
         * aplicativos, como criação de tarefas ou colunas. Se for
         * identificado um comando, executamos a ação correspondente e
         * respondemos no chat sem chamar a API.
         */
        const lower = text.toLowerCase();

        // Utilitário para localizar a instância de um aplicativo pelo seu tipo de dados
        const findAppInstance = (appDataType) => {
            for (const [id, winData] of window.windowManager.windows) {
                if (winData.currentAppInstance && winData.currentAppInstance.appDataType === appDataType) {
                    return winData.currentAppInstance;
                }
            }
            return null;
        };

        // Comandos que criam itens dentro dos aplicativos
        // 1. Criar nova tarefa no aplicativo de tarefas de projeto
        const createTaskMatch = /(?:\bcriar\b|\badicionar\b|\bnova\b|\bnovo\b)\s+(?:tarefa|task)\s+(.*)/i.exec(text);
        if (createTaskMatch) {
            const taskDesc = createTaskMatch[1].trim();
            if (taskDesc) {
                // Certifique-se de que o app de tarefas de projeto esteja aberto
                let tasksInstance = findAppInstance('project-tasks');
                if (!tasksInstance) {
                    // Abra o app usando a ação de atalho se estiver disponível
                    if (window.windowManager.appLaunchActions['open-project-tasks']) {
                        try { window.windowManager.appLaunchActions['open-project-tasks'](); } catch (e) { console.warn('Falha ao abrir tarefas de projeto:', e); }
                    }
                    // Após pequena espera, tente obter a instância novamente
                    await new Promise(resolve => setTimeout(resolve, 300));
                    tasksInstance = findAppInstance('project-tasks');
                }
                if (tasksInstance && Array.isArray(tasksInstance.tasks)) {
                    // Gerar ID simples
                    const newId = 'task_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                    const newTask = { id: newId, text: taskDesc, responsible: '', dueDate: null, priority: 'media', completed: false, subtasks: [] };
                    tasksInstance.tasks.push(newTask);
                    if (typeof tasksInstance.markDirty === 'function') tasksInstance.markDirty();
                    if (typeof tasksInstance.renderTasks === 'function') tasksInstance.renderTasks();
                    // Resposta da IA
                    const botMsgEl = document.createElement('div');
                    botMsgEl.className = 'ai-chat-bot-message';
                    botMsgEl.innerHTML = `<strong>IA:</strong> Tarefa criada: \"${taskDesc}\".`;
                    display.appendChild(botMsgEl);
                    display.scrollTop = display.scrollHeight;
                    return;
                }
            }
        }

        // 2. Criar nova coluna no Kanban
        const createColumnMatch = /(?:\bcriar\b|\badicionar\b|\bnova\b|\bnovo\b)\s+coluna\s+(.*)/i.exec(text);
        if (createColumnMatch) {
            const colTitle = createColumnMatch[1].trim();
            if (colTitle) {
                // Abrir/quebrar board
                let boardInstance = findAppInstance('kanban-board');
                if (!boardInstance) {
                    if (window.windowManager.appLaunchActions['open-kanban-board']) {
                        try { window.windowManager.appLaunchActions['open-kanban-board'](); } catch (e) { console.warn('Falha ao abrir quadro Kanban:', e); }
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                    boardInstance = findAppInstance('kanban-board');
                }
                if (boardInstance && boardInstance.boardData && Array.isArray(boardInstance.boardData.columns)) {
                    const newColId = 'col_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                    boardInstance.boardData.columns.push({ id: newColId, title: colTitle, cards: [] });
                    if (typeof boardInstance.markDirty === 'function') boardInstance.markDirty();
                    if (typeof boardInstance.renderBoard === 'function') boardInstance.renderBoard();
                    const botMsgEl = document.createElement('div');
                    botMsgEl.className = 'ai-chat-bot-message';
                    botMsgEl.innerHTML = `<strong>IA:</strong> Coluna criada: \"${colTitle}\".`;
                    display.appendChild(botMsgEl);
                    display.scrollTop = display.scrollHeight;
                    return;
                }
            }
        }

        // 3. Criar nova tarefa em cronogramas Gantt
        // Reconhece comandos como "criar tarefa X no Gantt", "adicionar tarefa Y no cronograma" etc.
        const createGanttMatch = /(?:\bcriar\b|\badicionar\b|\bnova\b|\bnovo\b)\s+tarefa\s+(?:no\s+)?(?:gantt|cronograma)?\s*(.*)/i.exec(text);
        if (createGanttMatch) {
            const taskName = createGanttMatch[1]?.trim();
            if (taskName) {
                let ganttInstance = findAppInstance('gantt-chart');
                if (!ganttInstance) {
                    if (window.windowManager.appLaunchActions['open-gantt-chart']) {
                        try { window.windowManager.appLaunchActions['open-gantt-chart'](); } catch (e) { console.warn('Falha ao abrir Gantt:', e); }
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                    ganttInstance = findAppInstance('gantt-chart');
                }
                if (ganttInstance && Array.isArray(ganttInstance.tasks)) {
                    if (typeof ganttInstance.addTask === 'function') {
                        ganttInstance.addTask();
                        const lastTask = ganttInstance.tasks[ganttInstance.tasks.length - 1];
                        if (lastTask) {
                            lastTask.name = taskName;
                        }
                        if (typeof ganttInstance.markDirty === 'function') ganttInstance.markDirty();
                        if (typeof ganttInstance.renderAll === 'function') ganttInstance.renderAll();
                        const botMsgEl = document.createElement('div');
                        botMsgEl.className = 'ai-chat-bot-message';
                        botMsgEl.innerHTML = `<strong>IA:</strong> Tarefa do Gantt criada: \"${taskName}\".`;
                        display.appendChild(botMsgEl);
                        display.scrollTop = display.scrollHeight;
                        return;
                    }
                }
            }
        }

        // 4. Criar novo card no Kanban (colocar tarefa no quadro)
        // Aceita comandos como "criar card X", "adicionar cartão Y", "adicionar tarefa Z no kanban"
        const createCardMatch = /(?:\bcriar\b|\badicionar\b|\bnova\b|\bnovo\b)\s+(?:card|cartão|tarefa(?:\s+kanban)?)\s+(.*)/i.exec(text);
        if (createCardMatch) {
            const cardTitle = createCardMatch[1]?.trim();
            if (cardTitle) {
                let boardInstance = findAppInstance('kanban-board');
                if (!boardInstance) {
                    if (window.windowManager.appLaunchActions['open-kanban-board']) {
                        try { window.windowManager.appLaunchActions['open-kanban-board'](); } catch (e) { console.warn('Falha ao abrir Kanban:', e); }
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                    boardInstance = findAppInstance('kanban-board');
                }
                if (boardInstance && boardInstance.boardData) {
                    // Se não houver colunas, criar uma padrão
                    if (!Array.isArray(boardInstance.boardData.columns) || boardInstance.boardData.columns.length === 0) {
                        const defaultColId = 'col_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                        boardInstance.boardData.columns = boardInstance.boardData.columns || [];
                        boardInstance.boardData.columns.push({ id: defaultColId, title: 'Pendente', cards: [] });
                    }
                    const column = boardInstance.boardData.columns[0];
                    const newCardId = 'card_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                    const newCard = { id: newCardId, title: cardTitle, description: '', priority: 'medium', dueDate: '', assignee: '', tags: [] };
                    column.cards.push(newCard);
                    if (typeof boardInstance.markDirty === 'function') boardInstance.markDirty();
                    if (typeof boardInstance.renderBoard === 'function') boardInstance.renderBoard();
                    const botMsgEl = document.createElement('div');
                    botMsgEl.className = 'ai-chat-bot-message';
                    botMsgEl.innerHTML = `<strong>IA:</strong> Card criado no Kanban: \"${cardTitle}\".`;
                    display.appendChild(botMsgEl);
                    display.scrollTop = display.scrollHeight;
                    return;
                }
            }
        }

        // Lista de comandos para apenas abrir aplicativos
        const commandMap = [
            { pattern: /(\babrir\b|\bopen\b).*kanban/, action: 'open-kanban-board', response: 'Abrindo quadro Kanban...' },
            { pattern: /(\babrir\b|\bopen\b).*(gantt|cronograma)/, action: 'open-gantt-chart', response: 'Abrindo Cronograma Gantt...' },
            { pattern: /(\babrir\b|\bopen\b).*(tarefas|project tasks|projeto)/, action: 'open-project-tasks', response: 'Abrindo Tarefas de Projeto...' },
            { pattern: /(\babrir\b|\bopen\b).*(swot)/, action: 'open-swot-analysis', response: 'Abrindo Análise SWOT...' },
            { pattern: /(\babrir\b|\bopen\b).*(sipoc)/, action: 'open-sipoc-matrix', response: 'Abrindo Matriz SIPOC...' },
            { pattern: /(\babrir\b|\bopen\b).*(okr)/, action: 'open-okr-tracker', response: 'Abrindo Monitor OKR...' },
            { pattern: /(\babrir\b|\bopen\b).*(ishikawa|diagrama)/, action: 'open-ishikawa-diagram', response: 'Abrindo Diagrama de Ishikawa...' },
            { pattern: /(\babrir\b|\bopen\b).*(bpmn)/, action: 'open-bpmn-modeler', response: 'Abrindo Modelador BPMN...' },
            { pattern: /(\babrir\b|\bopen\b).*(mapa mental|mind map)/, action: 'open-mind-map', response: 'Abrindo Mapa Mental...' },
            { pattern: /(\babrir\b|\bopen\b).*(contratos|contracts)/, action: 'open-contract-manager', response: 'Abrindo Gestão de Contratos...' },
            { pattern: /(\babrir\b|\bopen\b).*(checklist)/, action: 'open-checklist-tool', response: 'Abrindo Ferramenta de Checklist...' },
            { pattern: /(\babrir\b|\bopen\b).*(ncr|não conformidade)/, action: 'open-ncr-tool', response: 'Abrindo Relatório de Não Conformidade...' },
            { pattern: /(\babrir\b|\bopen\b).*(pdca)/, action: 'open-pdca-tool', response: 'Abrindo Ciclo PDCA...' },
            { pattern: /(\babrir\b|\bopen\b).*(5w2h)/, action: 'open-5w2h-tool', response: 'Abrindo Ferramenta 5W2H...' },
            { pattern: /(\babrir\b|\bopen\b).*(explorador|file|arquivos)/, action: 'open-file-system', response: 'Abrindo Explorador de Arquivos...' },
            { pattern: /(\babrir\b|\bopen\b).*(login|conta)/, action: 'open-login', response: 'Abrindo tela de Login...' }
        ];
        for (const cmd of commandMap) {
            if (cmd.pattern.test(lower)) {
                if (window.windowManager && window.windowManager.appLaunchActions && typeof window.windowManager.appLaunchActions[cmd.action] === 'function') {
                    try {
                        window.windowManager.appLaunchActions[cmd.action]();
                    } catch (err) {
                        console.error('Erro ao executar ação de comando IA:', err);
                    }
                }
                const botMsgEl = document.createElement('div');
                botMsgEl.className = 'ai-chat-bot-message';
                botMsgEl.innerHTML = `<strong>IA:</strong> ${cmd.response}`;
                display.appendChild(botMsgEl);
                display.scrollTop = display.scrollHeight;
                return;
            }
        }

        // Caso não seja um comando, chamar a API Gemini através da função serverless
        try {
            const res = await fetch('/.netlify/functions/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text })
            });
            const data = await res.json();
            let responseText;
            if (data && data.response) {
                responseText = data.response;
            } else {
                responseText = data.error || 'Sem resposta da IA.';
            }
            const botMsgEl = document.createElement('div');
            botMsgEl.className = 'ai-chat-bot-message';
            botMsgEl.innerHTML = `<strong>IA:</strong> ${responseText.replace(/\n/g, '<br>')}`;
            display.appendChild(botMsgEl);
            display.scrollTop = display.scrollHeight;
        } catch (e) {
            const errorEl = document.createElement('div');
            errorEl.className = 'ai-chat-error-message';
            errorEl.innerHTML = `<strong>Erro:</strong> Falha ao comunicar com a IA. ${e.message}`;
            display.appendChild(errorEl);
            display.scrollTop = display.scrollHeight;
        }
    };
    // Ações de envio: botão e tecla Enter
    button.onclick = sendMessage;
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
}