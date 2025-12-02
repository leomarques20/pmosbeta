/**
 * PMOS - Command Palette (estilo Spotlight/VSCode)
 * Atalho: CMD+K ou CTRL+K
 * 
 * Permite acesso rápido a qualquer funcionalidade do sistema
 */

class CommandPalette {
    constructor() {
        this.isOpen = false;
        this.commands = this.buildCommandIndex();
        this.filteredCommands = [];
        this.selectedIndex = 0;

        this.setupUI();
        this.registerShortcuts();
    }

    buildCommandIndex() {
        return [
            // Navegação
            { id: 'open-gantt', label: 'Abrir Cronograma Gantt', icon: '📊', category: 'Apps', action: () => window.windowManager.appLaunchActions['open-gantt-chart'](), keywords: ['cronograma', 'timeline', 'schedule'] },
            { id: 'open-kanban', label: 'Abrir Kanban Board', icon: '📋', category: 'Apps', action: () => window.windowManager.appLaunchActions['open-kanban-board'](), keywords: ['board', 'cards', 'sprints'] },
            { id: 'open-swot', label: 'Abrir Análise SWOT', icon: '🎯', category: 'Apps', action: () => window.windowManager.appLaunchActions['open-swot-analysis'](), keywords: ['estrategia', 'forcas', 'fraquezas'] },
            { id: 'open-mindmap', label: 'Abrir Mapa Mental', icon: '🧠', category: 'Apps', action: () => window.windowManager.appLaunchActions['open-mind-map'](), keywords: ['brainstorm', 'ideias'] },

            // Criação rápida
            { id: 'new-task', label: 'Criar nova tarefa', icon: '✅', category: 'Ações', action: () => this.createNewTask(), keywords: ['task', 'todo', 'atividade'] },
            { id: 'new-project', label: 'Criar novo projeto', icon: '📁', category: 'Ações', action: () => this.createNewProject(), keywords: ['projeto', 'workspace'] },
            { id: 'new-okr', label: 'Criar novo OKR', icon: '🎯', category: 'Ações', action: () => this.createNewOKR(), keywords: ['objetivo', 'meta', 'key result'] },

            // IA
            { id: 'ask-ai', label: 'Perguntar à IA...', icon: '🤖', category: 'IA', action: () => this.openAIChat(), keywords: ['gemini', 'assistant', 'help'] },
            { id: 'ai-analyze', label: 'IA: Analisar projeto atual', icon: '🔍', category: 'IA', action: () => this.aiAnalyzeProject(), keywords: ['analise', 'diagnostico', 'health'] },
            { id: 'ai-recommend', label: 'IA: Sugerir próximas ações', icon: '💡', category: 'IA', action: () => this.aiRecommendActions(), keywords: ['sugestao', 'recomendacao'] },

            // Sistema
            { id: 'toggle-dark', label: 'Alternar modo escuro', icon: '🌙', category: 'Sistema', action: () => window.themeManager.toggleDarkMode(), keywords: ['dark', 'light', 'theme'] },
            { id: 'show-shortcuts', label: 'Mostrar atalhos de teclado', icon: '⌨️', category: 'Ajuda', action: () => this.showShortcuts(), keywords: ['atalhos', 'keyboard', 'shortcuts'] },
            { id: 'stage-manager', label: 'Ativar Stage Manager', icon: '🔳', category: 'Sistema', action: () => window.windowManager.stageManager.toggle(), keywords: ['multitask', 'windows'] },

            // Ferramentas de Qualidade
            { id: 'open-pdca', label: 'Abrir Ciclo PDCA', icon: '♻️', category: 'Qualidade', action: () => window.windowManager.appLaunchActions['open-pdca-tool'](), keywords: ['melhoria', 'continua'] },
            { id: 'open-ishikawa', label: 'Abrir Diagrama Ishikawa', icon: '🐟', category: 'Qualidade', action: () => window.windowManager.appLaunchActions['open-ishikawa-diagram'](), keywords: ['causa', 'efeito', 'espinha'] },
            { id: 'open-5w2h', label: 'Abrir Ferramenta 5W2H', icon: '❓', category: 'Qualidade', action: () => window.windowManager.appLaunchActions['open-5w2h-tool'](), keywords: ['plano', 'acao'] }
        ];
    }

    setupUI() {
        const container = document.createElement('div');
        container.id = 'command-palette';
        container.className = 'command-palette-overlay';
        container.style.display = 'none';

        container.innerHTML = `
      <div class="command-palette-modal">
        <div class="command-palette-header">
          <input 
            type="text" 
            id="command-palette-input" 
            placeholder="Digite um comando ou pesquise..."
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="command-palette-results" id="command-palette-results"></div>
        <div class="command-palette-footer">
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>Esc fechar</span>
        </div>
      </div>
    `;

        document.body.appendChild(container);

        const input = document.getElementById('command-palette-input');
        input.addEventListener('input', (e) => this.handleSearch(e.target.value));
        input.addEventListener('keydown', (e) => this.handleKeydown(e));

        container.addEventListener('click', (e) => {
            if (e.target === container) this.close();
        });

        this.addStyles();
    }

    registerShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        const palette = document.getElementById('command-palette');
        const input = document.getElementById('command-palette-input');

        palette.style.display = 'flex';
        input.focus();
        input.value = '';

        this.filteredCommands = this.getRecentCommands();
        this.renderResults();
    }

    close() {
        this.isOpen = false;
        document.getElementById('command-palette').style.display = 'none';
        this.selectedIndex = 0;
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.filteredCommands = this.getRecentCommands();
        } else {
            this.filteredCommands = this.fuzzySearch(query);
        }

        this.selectedIndex = 0;
        this.renderResults();
    }

    fuzzySearch(query) {
        const lowerQuery = query.toLowerCase();

        return this.commands
            .map(cmd => {
                let score = 0;
                if (cmd.label.toLowerCase().includes(lowerQuery)) score += 10;
                if (cmd.label.toLowerCase().startsWith(lowerQuery)) score += 20;
                if (cmd.keywords?.some(k => k.includes(lowerQuery))) score += 5;
                if (cmd.category?.toLowerCase().includes(lowerQuery)) score += 3;

                return { ...cmd, score };
            })
            .filter(cmd => cmd.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }

    renderResults() {
        const resultsContainer = document.getElementById('command-palette-results');

        if (this.filteredCommands.length === 0) {
            resultsContainer.innerHTML = '<div class="command-palette-empty">Nenhum comando encontrado</div>';
            return;
        }

        resultsContainer.innerHTML = this.filteredCommands
            .map((cmd, index) => `
        <div 
          class="command-palette-item ${index === this.selectedIndex ? 'selected' : ''}" 
          data-index="${index}"
          onclick="window.commandPalette.executeCommand(${index})"
        >
          <span class="command-icon">${cmd.icon}</span>
          <div class="command-content">
            <div class="command-label">${cmd.label}</div>
            <div class="command-category">${cmd.category}</div>
          </div>
        </div>
      `)
            .join('');
    }

    handleKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
                this.renderResults();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.renderResults();
                break;
            case 'Enter':
                e.preventDefault();
                this.executeCommand(this.selectedIndex);
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    executeCommand(index) {
        const cmd = this.filteredCommands[index];
        if (!cmd) return;

        this.saveRecentCommand(cmd.id);

        try {
            cmd.action();
            this.close();
        } catch (error) {
            console.error('Erro ao executar comando:', error);
        }
    }

    getRecentCommands() {
        const recent = JSON.parse(localStorage.getItem('pmos_recent_commands') || '[]');
        return this.commands.filter(cmd => recent.includes(cmd.id)).slice(0, 5);
    }

    saveRecentCommand(cmdId) {
        let recent = JSON.parse(localStorage.getItem('pmos_recent_commands') || '[]');
        recent = [cmdId, ...recent.filter(id => id !== cmdId)].slice(0, 10);
        localStorage.setItem('pmos_recent_commands', JSON.stringify(recent));
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
      .command-palette-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 15vh;
      }

      .command-palette-modal {
        background: var(--window-bg);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 640px;
        overflow: hidden;
        animation: slideDown 0.2s ease-out;
      }

      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .command-palette-header {
        padding: 16px;
        border-bottom: 1px solid var(--separator-color);
      }

      #command-palette-input {
        width: 100%;
        font-size: 18px;
        padding: 12px;
        border: none;
        background: transparent;
        color: var(--text-color);
        outline: none;
      }

      .command-palette-results {
        max-height: 400px;
        overflow-y: auto;
      }

      .command-palette-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .command-palette-item:hover,
      .command-palette-item.selected {
        background: var(--hover-highlight-color);
      }

      .command-icon {
        font-size: 24px;
        margin-right: 12px;
      }

      .command-content {
        flex: 1;
      }

      .command-label {
        font-size: 14px;
        color: var(--text-color);
        font-weight: 500;
      }

      .command-category {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }

      .command-palette-footer {
        padding: 8px 16px;
        border-top: 1px solid var(--separator-color);
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .command-palette-empty {
        padding: 32px;
        text-align: center;
        color: var(--secondary-text-color);
      }
    `;
        document.head.appendChild(style);
    }

    // Ações helper
    createNewTask() { showNotification('Criar tarefa - em desenvolvimento', 2000); }
    createNewProject() { showNotification('Criar projeto - em desenvolvimento', 2000); }
    createNewOKR() { window.windowManager.appLaunchActions['open-okr-tracker'](); }
    openAIChat() { document.getElementById('pmos-ai-toggle')?.click(); }
    aiAnalyzeProject() { showNotification('IA analisando projeto...', 2000); }
    aiRecommendActions() { showNotification('IA gerando recomendações...', 2000); }
    showShortcuts() { alert('Atalhos:\nCMD+K - Command Palette\nCMD+. - IA Assistant\nCMD+S - Salvar'); }
}

// Inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.commandPalette = new CommandPalette();
    });
} else {
    window.commandPalette = new CommandPalette();
}
