/**
 * PMOS - Contextual Intelligence Engine
 * Sistema de recomendações proativas baseado em análise de comportamento
 */

// `showNotification` é exportada por js/main.js (não é global). Este arquivo é um
// script clássico, então usa um fallback seguro.
function showNotification(message, duration = 3000) {
    if (typeof window.showNotification === 'function') window.showNotification(message, duration);
    else console.info('[PMOS]', message);
}

function readJSONStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

class ContextualIntelligence {
    constructor() {
        this.userBehavior = {
            appsOpened: [],
            actionsPerformed: [],
            patterns: new Map()
        };

        this.recommendations = [];
        this.shownRecommendationIds = new Set(); // evita repetir o mesmo toast a cada ciclo
        this.isMonitoring = false;

        // Carrega estado salvo
        this.loadState();

        // Inicia monitoramento
        this.startMonitoring();
    }

    startMonitoring() {
        if (this.isMonitoring) return;

        // O WindowManager é criado por js/main.js (módulo); aguarda até ele existir.
        if (!window.windowManager || typeof window.windowManager.createWindow !== 'function') {
            this._waitAttempts = (this._waitAttempts || 0) + 1;
            if (this._waitAttempts <= 60) setTimeout(() => this.startMonitoring(), 500);
            else console.warn('ContextualIntelligence: WindowManager não encontrado; monitoramento desativado.');
            return;
        }
        this.isMonitoring = true;

        // Monitora abertura de apps
        this.monitorAppOpenings();

        // Analisa padrões a cada 30 segundos
        setInterval(() => this.analyzeAndRecommend(), 30000);

        // Análise profunda a cada 5 minutos
        setInterval(() => this.deepAnalysis(), 300000);
    }

    monitorAppOpenings() {
        // Hook no WindowManager para detectar abertura de janelas
        const originalCreateWindow = window.windowManager.createWindow;

        window.windowManager.createWindow = (...args) => {
            const winId = originalCreateWindow.apply(window.windowManager, args);

            // Registra abertura
            const winData = window.windowManager.windows.get(winId);
            if (winData) {
                this.logAction({
                    type: 'app_opened',
                    appType: winData.appType,
                    timestamp: Date.now()
                });

                // Gera recomendações contextuais
                this.onAppOpened(winData.appType);
            }

            return winId;
        };
    }

    logAction(action) {
        this.userBehavior.actionsPerformed.push(action);

        // Mantém apenas últimas 100 ações
        if (this.userBehavior.actionsPerformed.length > 100) {
            this.userBehavior.actionsPerformed.shift();
        }

        // Salva periodicamente
        this.saveState();
    }

    async onAppOpened(appType) {
        appType = String(appType || '');
        // Recomendações imediatas baseadas no contexto
        const recommendations = [];

        // Se abriu Gantt, sugerir apps complementares
        if (appType.includes('gantt')) {
            recommendations.push({
                id: 'gantt-to-kanban',
                type: 'quick-action',
                priority: 'medium',
                icon: '📋',
                title: 'Complementar com Kanban?',
                description: 'Visualize tarefas em quadros para melhor acompanhamento diário',
                action: () => window.windowManager.appLaunchActions['open-kanban-board'](),
                dismissable: true
            });

            recommendations.push({
                id: 'gantt-ai-optimize',
                type: 'ai-suggestion',
                priority: 'high',
                icon: '🤖',
                title: 'IA: Otimizar cronograma',
                description: 'Analisar dependências e sugerir otimizações de prazo',
                action: () => this.aiOptimizeGantt(),
                dismissable: true
            });
        }

        // Se abriu Kanban, detectar padrão de sprint
        if (appType.includes('kanban')) {
            const kanbanOpenCount = this.countAppOpenings('kanban', 7); // últimos 7 dias

            if (kanbanOpenCount > 5) {
                recommendations.push({
                    id: 'kanban-sprint-template',
                    type: 'template',
                    priority: 'medium',
                    icon: '🏃',
                    title: 'Usar template de Sprint?',
                    description: 'Você abre Kanban frequentemente. Quer um template Scrum?',
                    action: () => this.applyScrumTemplate(),
                    dismissable: true
                });
            }
        }

        // Se abriu SWOT, sugerir OKRs
        if (appType.includes('swot')) {
            recommendations.push({
                id: 'swot-to-okr',
                type: 'workflow',
                priority: 'high',
                icon: '🎯',
                title: 'Transformar em OKRs?',
                description: 'Converta insights da análise SWOT em objetivos mensuráveis',
                action: () => this.swotToOKR(),
                dismissable: true
            });
        }

        // Se abriu múltiplas ferramentas de qualidade
        const qualityAppsOpened = this.getOpenQualityApps();
        if (qualityAppsOpened.length >= 2) {
            recommendations.push({
                id: 'quality-dashboard',
                type: 'insight',
                priority: 'high',
                icon: '📊',
                title: 'Dashboard de Qualidade',
                description: `${qualityAppsOpened.length} ferramentas de qualidade abertas. Criar dashboard consolidado?`,
                action: () => this.createQualityDashboard(),
                dismissable: true
            });
        }

        // Mostra recomendações
        if (recommendations.length > 0) {
            this.showRecommendations(recommendations);
        }
    }

    async analyzeAndRecommend() {
        if (!window.windowManager?.windows) return;
        const openApps = Array.from(window.windowManager.windows.values())
            .filter(w => !w.minimized)
            .map(w => String(w.appType || ''));

        // Detecta projeto em andamento
        if (openApps.length >= 3) {
            const projectPattern = this.detectProjectPattern(openApps);

            if (projectPattern === 'planning') {
                this.recommend({
                    id: 'planning-checklist',
                    type: 'ai-suggestion',
                    priority: 'medium',
                    icon: '✅',
                    title: 'IA: Checklist de Planejamento',
                    description: 'Detectei fase de planejamento. Quer um checklist automático?',
                    action: () => this.generatePlanningChecklist(),
                    dismissable: true
                });
            }

            if (projectPattern === 'execution') {
                this.recommend({
                    id: 'execution-monitor',
                    type: 'ai-suggestion',
                    priority: 'high',
                    icon: '⚡',
                    title: 'Monitoramento Automático',
                    description: 'Ativar alertas de atrasos e desvios de orçamento?',
                    action: () => this.enableAutoMonitoring(),
                    dismissable: true
                });
            }
        }

        // Detecta falta de uso de IA
        const lastAIUse = localStorage.getItem('pmos_last_ai_use');
        if (!lastAIUse || Date.now() - parseInt(lastAIUse) > 24 * 60 * 60 * 1000) {
            this.recommend({
                id: 'ai-reminder',
                type: 'tip',
                priority: 'low',
                icon: '💡',
                title: 'Dica: Use a IA!',
                description: 'Pressione CTRL+. para pedir ajuda à IA com qualquer tarefa',
                action: () => document.getElementById('pmos-ai-toggle')?.click(),
                dismissable: true
            });
        }
    }

    async deepAnalysis() {
        // Análise de padrões mais complexa
        const patterns = this.detectPatterns();

        // Padrão: Sempre cria OKR após SWOT
        if (patterns.swotToOkr?.frequency > 0.7) {
            this.recommend({
                id: 'automate-swot-okr',
                type: 'automation',
                priority: 'high',
                icon: '⚙️',
                title: 'Automatizar SWOT → OKR?',
                description: 'Você sempre cria OKRs após SWOT. Quer automatizar?',
                action: () => this.createAutomation('swot-to-okr'),
                dismissable: false
            });
        }

        // Detecta underutilização de features
        const unusedFeatures = this.detectUnusedFeatures();
        if (unusedFeatures.length > 0) {
            this.recommend({
                id: 'feature-discovery',
                type: 'tip',
                priority: 'low',
                icon: '🔍',
                title: 'Explore novos recursos',
                description: `Você ainda não usou: ${unusedFeatures.join(', ')}`,
                action: () => this.showFeatureTour(unusedFeatures[0]),
                dismissable: true
            });
        }
    }

    detectProjectPattern(openApps) {
        // Planningng: SWOT, Mind Map, ou múltiplas ferramentas de planejamento
        const planningApps = ['swot', 'mind-map', 'sipoc', 'bpmn'];
        const planningCount = openApps.filter(app =>
            planningApps.some(p => app.includes(p))
        ).length;

        if (planningCount >= 2) return 'planning';

        // Execution: Gantt, Kanban, Tasks
        const executionApps = ['gantt', 'kanban', 'project-tasks'];
        const executionCount = openApps.filter(app =>
            executionApps.some(e => app.includes(e))
        ).length;

        if (executionCount >= 2) return 'execution';

        // Quality: PDCA, Ishikawa, NCR, 5W2H
        const qualityApps = ['pdca', 'ishikawa', 'ncr', '5w2h', 'checklist'];
        const qualityCount = openApps.filter(app =>
            qualityApps.some(q => app.includes(q))
        ).length;

        if (qualityCount >= 2) return 'quality';

        return 'unknown';
    }

    detectPatterns() {
        // Analisa sequências de ações
        const actions = this.userBehavior.actionsPerformed;
        const patterns = {};

        // Padrão SWOT → OKR
        let swotToOkrCount = 0;
        let swotCount = 0;

        for (let i = 0; i < actions.length - 1; i++) {
            if (actions[i].appType?.includes('swot')) {
                swotCount++;
                // Próxima ação nas próximas 10 ações
                for (let j = i + 1; j < Math.min(i + 10, actions.length); j++) {
                    if (actions[j].appType?.includes('okr')) {
                        swotToOkrCount++;
                        break;
                    }
                }
            }
        }

        patterns.swotToOkr = {
            frequency: swotCount > 0 ? swotToOkrCount / swotCount : 0,
            count: swotToOkrCount
        };

        return patterns;
    }

    detectUnusedFeatures() {
        const allApps = [
            'gantt-chart', 'kanban-board', 'swot-analysis', 'sipoc-matrix',
            'okr-tracker', 'ishikawa-diagram', 'bpmn-modeler', 'mind-map',
            'contract-manager', 'checklist-tool', 'ncr-tool', 'pdca-tool', '5w2h-tool'
        ];

        const usedApps = new Set(
            this.userBehavior.actionsPerformed
                .filter(a => a.type === 'app_opened')
                .map(a => String(a.appType || ''))
        );

        return allApps.filter(app => !Array.from(usedApps).some(used => used.includes(app)));
    }

    countAppOpenings(appType, daysAgo = 7) {
        const since = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);

        return this.userBehavior.actionsPerformed.filter(action =>
            action.type === 'app_opened' &&
            action.appType?.includes(appType) &&
            action.timestamp >= since
        ).length;
    }

    getOpenQualityApps() {
        const qualityAppTypes = ['pdca', 'ishikawa', 'ncr', '5w2h', 'checklist'];

        if (!window.windowManager?.windows) return [];
        return Array.from(window.windowManager.windows.values())
            .filter(w => !w.minimized && qualityAppTypes.some(q => String(w.appType || '').includes(q)))
            .map(w => w.appType);
    }

    recommend(recommendation) {
        // Recomendações periódicas (a cada 30s / 5min) só aparecem uma vez por sessão.
        if (this.shownRecommendationIds.has(recommendation.id)) return;
        this.recommendations.push(recommendation);
        this.showRecommendations([recommendation]);
    }

    showRecommendations(recommendations) {
        // Cria toast de notificação com recomendação
        recommendations.forEach((rec, index) => {
            setTimeout(() => {
                this.showRecommendationToast(rec);
            }, index * 500); // Escalonado
        });
    }

    showRecommendationToast(rec) {
        // Verifica se já foi dispensada
        const dismissed = readJSONStorage('pmos_dismissed_recommendations', []);
        if (Array.isArray(dismissed) && dismissed.includes(rec.id)) return;
        if (document.querySelector(`.pmos-recommendation-toast[data-rec-id="${rec.id}"]`)) return;
        this.shownRecommendationIds.add(rec.id);

        const toast = document.createElement('div');
        toast.className = `pmos-recommendation-toast priority-${rec.priority}`;
        toast.dataset.recId = rec.id;
        toast.innerHTML = `
      <div class="rec-icon">${rec.icon}</div>
      <div class="rec-content">
        <div class="rec-title">${rec.title}</div>
        <div class="rec-description">${rec.description}</div>
      </div>
      <div class="rec-actions">
        <button class="rec-action-btn primary" data-action="execute">Executar</button>
        ${rec.dismissable ? '<button class="rec-action-btn secondary" data-action="dismiss">Dispensar</button>' : ''}
      </div>
    `;

        // Event listeners
        toast.querySelector('[data-action="execute"]').onclick = () => {
            try {
                rec.action();
            } catch (e) {
                console.error('Erro ao executar recomendação:', e);
            }
            toast.remove();
        };

        if (rec.dismissable) {
            toast.querySelector('[data-action="dismiss"]').onclick = () => {
                this.dismissRecommendation(rec.id);
                toast.remove();
            };
        }

        // Adiciona ao DOM
        let container = document.getElementById('pmos-recommendations-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pmos-recommendations-container';
            document.body.appendChild(container);
            this.addRecommendationStyles();
        }

        container.appendChild(toast);

        // Auto-remove após 15 segundos (se dismissable)
        if (rec.dismissable) {
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 15000);
        }
    }

    dismissRecommendation(recId) {
        const stored = readJSONStorage('pmos_dismissed_recommendations', []);
        const dismissed = Array.isArray(stored) ? stored : [];
        if (!dismissed.includes(recId)) dismissed.push(recId);
        try { localStorage.setItem('pmos_dismissed_recommendations', JSON.stringify(dismissed)); } catch (e) { /* armazenamento indisponível */ }
    }

    // Ações específicas
    async aiOptimizeGantt() {
        showNotification('🤖 IA analisando cronograma...', 2000);
        // TODO: Implementar otimização de Gantt
    }

    async applyScrumTemplate() {
        showNotification('📋 Aplicando template Scrum...', 2000);
        // TODO: Implementar template
    }

    async swotToOKR() {
        showNotification('🎯 Convertendo SWOT em OKRs...', 2000);
        // TODO: Implementar conversão
    }

    async createQualityDashboard() {
        showNotification('📊 Criando dashboard de qualidade...', 2000);
        // TODO: Implementar dashboard
    }

    async generatePlanningChecklist() {
        showNotification('✅ Gerando checklist...', 2000);
        // TODO: Implementar checklist
    }

    async enableAutoMonitoring() {
        showNotification('⚡ Monitoramento ativado!', 2000);
        localStorage.setItem('pmos_auto_monitoring', 'true');
    }

    async createAutomation(type) {
        showNotification(`⚙️ Automação ${type} criada!`, 2000);
        // TODO: Implementar automações
    }

    async showFeatureTour(feature) {
        showNotification(`🔍 Iniciando tour: ${feature}`, 2000);
        // TODO: Implementar tour
    }

    // Persistência
    saveState() {
        try {
            localStorage.setItem('pmos_contextual_intelligence', JSON.stringify({
                actionsPerformed: this.userBehavior.actionsPerformed.slice(-50), // últimas 50
                timestamp: Date.now()
            }));
        } catch (e) { /* armazenamento indisponível */ }
    }

    loadState() {
        let saved = null;
        try { saved = localStorage.getItem('pmos_contextual_intelligence'); } catch (e) { saved = null; }
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.userBehavior.actionsPerformed = Array.isArray(data.actionsPerformed) ? data.actionsPerformed : [];
            } catch (e) {
                console.warn('Erro ao carregar estado do ContextualIntelligence', e);
            }
        }
    }

    addRecommendationStyles() {
        const style = document.createElement('style');
        style.textContent = `
      #pmos-recommendations-container {
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 420px;
      }

      .pmos-recommendation-toast {
        background: var(--window-bg);
        border: 2px solid var(--accent-color);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        display: flex;
        gap: 12px;
        align-items: flex-start;
        animation: slideInRight 0.3s ease-out;
      }

      .pmos-recommendation-toast.priority-high {
        border-color: #FF9500;
      }

      .pmos-recommendation-toast.priority-medium {
        border-color: var(--accent-color);
      }

      .pmos-recommendation-toast.priority-low {
        border-color: #8E8E93;
      }

      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .rec-icon {
        font-size: 32px;
        flex-shrink: 0;
      }

      .rec-content {
        flex: 1;
      }

      .rec-title {
        font-weight: 600;
        font-size: 14px;
        color: var(--text-color);
        margin-bottom: 4px;
      }

      .rec-description {
        font-size: 12px;
        color: var(--secondary-text-color);
        line-height: 1.4;
      }

      .rec-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .rec-action-btn {
        padding: 6px 12px;
        border-radius: 6px;
        border: none;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .rec-action-btn.primary {
        background: var(--accent-color);
        color: white;
      }

      .rec-action-btn.primary:hover {
        transform: scale(1.05);
      }

      .rec-action-btn.secondary {
        background: transparent;
        color: var(--secondary-text-color);
      }

      .rec-action-btn.secondary:hover {
        background: var(--hover-highlight-color);
      }
    `;
        document.head.appendChild(style);
    }
}

// Inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.contextualIntelligence = new ContextualIntelligence();
    });
} else {
    window.contextualIntelligence = new ContextualIntelligence();
}
