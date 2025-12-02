import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openSWOTAnalysis() {
    const uniqueSuffix = generateId('swot');
    const winId = window.windowManager.createWindow('Análise SWOT', '', { width: '800px', height: '600px', appType: 'swot-analysis' });
    const content = `
        <div class="app-toolbar"> ${getStandardAppToolbarHTML()} </div>
        <div class="swot-grid-container">
            <div class="swot-quadrant"> <h3><i class="fas fa-thumbs-up" style="color:green;"></i> Forças (Strengths)</h3> <textarea id="swotStrengths_${uniqueSuffix}" placeholder="Pontos fortes internos..."></textarea> </div>
            <div class="swot-quadrant"> <h3><i class="fas fa-thumbs-down" style="color:red;"></i> Fraquezas (Weaknesses)</h3> <textarea id="swotWeaknesses_${uniqueSuffix}" placeholder="Pontos fracos internos..."></textarea> </div>
            <div class="swot-quadrant"> <h3><i class="fas fa-lightbulb" style="color:orange;"></i> Oportunidades (Opportunities)</h3> <textarea id="swotOpportunities_${uniqueSuffix}" placeholder="Fatores externos positivos..."></textarea> </div>
            <div class="swot-quadrant"> <h3><i class="fas fa-exclamation-triangle" style="color:purple;"></i> Ameaças (Threats)</h3> <textarea id="swotThreats_${uniqueSuffix}" placeholder="Fatores externos negativos..."></textarea> </div>
        </div>`;
    const winData = window.windowManager.windows.get(winId); if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;

    const appState = {
        winId, appDataType: 'swot-analysis',
        strengthsEl: winData.element.querySelector(`#swotStrengths_${uniqueSuffix}`), 
        weaknessesEl: winData.element.querySelector(`#swotWeaknesses_${uniqueSuffix}`), 
        opportunitiesEl: winData.element.querySelector(`#swotOpportunities_${uniqueSuffix}`), 
        threatsEl: winData.element.querySelector(`#swotThreats_${uniqueSuffix}`),
        getData: function() { return { strengths: this.strengthsEl.value, weaknesses: this.weaknessesEl.value, opportunities: this.opportunitiesEl.value, threats: this.threatsEl.value }; },
        loadData: function(dataString, fileMeta) { 
            try { 
                const data = JSON.parse(dataString);
                this.strengthsEl.value = data.strengths || ''; 
                this.weaknessesEl.value = data.weaknesses || ''; 
                this.opportunitiesEl.value = data.opportunities || ''; 
                this.threatsEl.value = data.threats || ''; 
                this.fileId = fileMeta.id; 
                this.markClean(); 
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
            } catch (e) { 
                showNotification("Erro ao ler arquivo SWOT.", 3000); 
            } 
        },
        cleanup: () => {}
    };
    initializeFileState(appState, "Nova Análise SWOT", "analise.swot", "swot-analysis");
    winData.currentAppInstance = appState;
    setupAppToolbarActions(appState);
    [appState.strengthsEl, appState.weaknessesEl, appState.opportunitiesEl, appState.threatsEl].forEach(el => el.oninput = () => appState.markDirty());
    return winId;
}