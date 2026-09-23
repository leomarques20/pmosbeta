import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openOKRTracker() {
    const uniqueSuffix = generateId('okr');
    const winId = window.windowManager.createWindow('Monitor de OKRs', '', { width: '950px', height: '700px', appType: 'okr-tracker' });
    const content = `
        <div class="app-toolbar"> ${getStandardAppToolbarHTML()} <button id="addObjectiveBtn_${uniqueSuffix}" class="app-button" style="margin-left: auto;"><i class="fas fa-plus-circle"></i> Novo Objetivo</button> </div>
        <div class="okr-objectives-container" id="objectivesContainer_${uniqueSuffix}"></div>`;
    const winData = window.windowManager.windows.get(winId); if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;

    const appState = {
        winId, objectives: [], appDataType: 'okr-tracker',
        containerEl: winData.element.querySelector(`#objectivesContainer_${uniqueSuffix}`),
        getData: function() { return this.objectives; },
        loadData: function(dataString, fileMeta) { 
            try { 
                const data = JSON.parse(dataString);
                this.objectives = Array.isArray(data) ? data.map(obj => ({...obj, keyResults: obj.keyResults || []})) : []; 
                this.fileId = fileMeta.id; 
                this.markClean(); 
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
                this.renderObjectives(); 
            } catch (e) { 
                showNotification("Erro ao ler arquivo OKR.", 3000); 
            } 
        },
        renderObjectives: function() { this.containerEl.innerHTML = ''; this.objectives.forEach((obj, objIndex) => { const objEl = document.createElement('div'); objEl.className = 'okr-objective'; objEl.innerHTML = `<div class="okr-objective-header"> <h3><i class="fas fa-bullseye" style="margin-right:8px; opacity:0.7;"></i> Objetivo ${objIndex + 1}:</h3> <input type="text" class="app-input okr-objective-title-input" value="${obj.text}" placeholder="Descrição do Objetivo" data-obj-index="${objIndex}" data-field="text"> <input type="text" class="app-input okr-objective-cycle-input" value="${obj.cycle || ''}" placeholder="Ciclo/Período" data-obj-index="${objIndex}" data-field="cycle"> <button class="app-button secondary" data-action="add-kr" data-obj-index="${objIndex}" title="Adicionar Resultado Chave"><i class="fas fa-plus"></i> KR</button> <button class="app-button danger" data-action="delete-obj" data-obj-index="${objIndex}" title="Excluir Objetivo" style="margin-left:5px;"><i class="fas fa-trash"></i></button> </div> <div class="keyresults-container" id="krContainer_${uniqueSuffix}_${objIndex}"></div>`; this.containerEl.appendChild(objEl); const krContainer = objEl.querySelector(`#krContainer_${uniqueSuffix}_${objIndex}`); obj.keyResults.forEach((kr, krIndex) => this.renderKeyResult(krContainer, objIndex, krIndex, kr)); }); },
        renderKeyResult: function(krContainerEl, objIndex, krIndex, krData) { const krEl = document.createElement('div'); krEl.className = 'okr-keyresult'; const progress = krData.target > 0 ? ((krData.current || 0) / krData.target) * 100 : 0; krEl.innerHTML = `<input type="text" class="app-input" value="${krData.text}" placeholder="Resultado Chave ${krIndex + 1}" data-obj-index="${objIndex}" data-kr-index="${krIndex}" data-field="text"> <input type="number" class="app-input" value="${krData.current || ''}" placeholder="Atual" title="Valor Atual" data-obj-index="${objIndex}" data-kr-index="${krIndex}" data-field="current"> <input type="number" class="app-input" value="${krData.target || ''}" placeholder="Meta" title="Valor Meta" data-obj-index="${objIndex}" data-kr-index="${krIndex}" data-field="target"> <input type="text" class="app-input" value="${krData.unit || ''}" placeholder="Unid." title="Unidade" style="width:60px;" data-obj-index="${objIndex}" data-kr-index="${krIndex}" data-field="unit"> <select class="app-select" data-obj-index="${objIndex}" data-kr-index="${krIndex}" data-field="confidence" title="Confiança"> <option value="alta" ${krData.confidence === 'alta' ? 'selected' : ''}>Alta</option> <option value="media" ${krData.confidence === 'media' || !krData.confidence ? 'selected' : ''}>Média</option> <option value="baixa" ${krData.confidence === 'baixa' ? 'selected' : ''}>Baixa</option> </select> <div class="progress-bar-container" title="Progresso: ${progress.toFixed(0)}%"><div class="progress-bar" style="width:${Math.min(100,progress)}%;"></div></div> <button class="app-button danger action-button" data-action="delete-kr" data-obj-index="${objIndex}" data-kr-index="${krIndex}" title="Excluir KR"><i class="fas fa-times"></i></button>`; krContainerEl.appendChild(krEl); },
        addObjective: function() { this.objectives.push({ id: generateId('obj'), text: '', cycle: '', keyResults: [{ id: generateId('kr'), text: '', current: null, target: null, unit: '', confidence: 'media' }] }); this.markDirty(); this.renderObjectives(); },
        addKeyResult: function(objIndex) { this.objectives[objIndex].keyResults.push({ id: generateId('kr'), text: '', current: null, target: null, unit: '', confidence: 'media' }); this.markDirty(); this.renderObjectives(); },
        deleteObjective: function(objIndex) { this.objectives.splice(objIndex, 1); this.markDirty(); this.renderObjectives(); },
        deleteKeyResult: function(objIndex, krIndex) { this.objectives[objIndex].keyResults.splice(krIndex, 1); this.markDirty(); this.renderObjectives(); },
        updateData: function(objIndex, krIndex, field, value) {
            if (krIndex === undefined) {
                this.objectives[objIndex][field] = value;
            } else {
                const kr = this.objectives[objIndex].keyResults[krIndex];
                if (field === 'current' || field === 'target') {
                    value = parseFloat(value) || null;
                    kr[field] = value;
                    this.renderObjectives();
                } else {
                    kr[field] = value;
                }
            }
            this.markDirty();
        },
        cleanup: () => {}
    };
    initializeFileState(appState, "Monitor de OKRs", "okrs.okr", "okr-tracker"); 
    winData.currentAppInstance = appState;
    setupAppToolbarActions(appState);
    winData.element.querySelector('#addObjectiveBtn_'+uniqueSuffix).onclick = () => appState.addObjective();
    appState.containerEl.addEventListener('click', (e) => { const targetButton = e.target.closest('button'); if (!targetButton) return; const action = targetButton.dataset.action; const objIndex = parseInt(targetButton.dataset.objIndex); const krIndex = e.target.dataset.krIndex !== undefined ? parseInt(e.target.dataset.krIndex) : undefined; if (action === 'add-kr') appState.addKeyResult(objIndex); else if (action === 'delete-obj') appState.deleteObjective(objIndex); else if (action === 'delete-kr') appState.deleteKeyResult(objIndex, krIndex); });
    appState.containerEl.addEventListener('input', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { const objIndex = parseInt(e.target.dataset.objIndex); const krIndex = e.target.dataset.krIndex !== undefined ? parseInt(e.target.dataset.krIndex) : undefined; const field = e.target.dataset.field; appState.updateData(objIndex, krIndex, field, e.target.value); } });
    if (appState.objectives.length === 0) appState.addObjective();
    return winId;
}