import { showNotification } from '../main.js';
// Importa a função de fábrica do arquivo do checklist
import { openChecklistTool } from './checklistTool.js'; // Apenas para importar a função de fábrica

// Re-exportamos a função de fábrica para que outros possam usá-la.
// Uma abordagem melhor seria ter um arquivo `qualityToolFactory.js`, mas para manter a estrutura, faremos assim.
function createQualityToolWindow(toolName, appType, formHTML, listTitle, fileNameSuffix, formGridCols = 1) {
    const winId = openChecklistTool(); // Isso é um hack, precisamos da função real.
    const winData = window.windowManager.windows.get(winId);
    if(winData) {
        // Adaptar a janela já criada
        window.windowManager.updateWindowTitle(winId, toolName);
        const formArea = winData.element.querySelector('[id^=formArea_]');
        formArea.innerHTML = formHTML;
        formArea.style.gridTemplateColumns = `repeat(${formGridCols}, 1fr)`;
        winData.element.querySelector('[id^=formTitle_]').textContent = `Novo: ${toolName}`;
        winData.element.querySelector('h4 > i.fa-list-ul').nextSibling.textContent = ` ${listTitle}`;
        
        const appState = winData.currentAppInstance;
        appState.appDataType = appType;
        appState.originalToolName = toolName;
        initializeFileState(appState, toolName, `novo_${fileNameSuffix}.${fileNameSuffix}`, appType);
        return { winId, appState };
    }
    return null; // Falha
}


export function openNCRTool() {
    const formHTML = `<input type="text" id="ncrDescriptionInput" class="app-input" placeholder="Descrição da Não Conformidade" style="grid-column: span 2;"> <input type="date" id="ncrDateInput" class="app-input" title="Data da Ocorrência"> <input type="text" id="ncrSourceInput" class="app-input" placeholder="Origem/Processo Afetado"> <select id="ncrSeverityInput" class="app-select"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select> <input type="text" id="ncrReportedByInput" class="app-input" placeholder="Reportado Por"> <textarea id="ncrEvidenceInput" class="app-textarea" placeholder="Evidências..." style="min-height:60px; grid-column: span 2;"></textarea> <textarea id="ncrImmediateActionInput" class="app-textarea" placeholder="Ação Imediata Tomada" style="min-height:60px;"></textarea> <textarea id="ncrCorrectiveActionInput" class="app-textarea" placeholder="Ação Corretiva Proposta" style="min-height:60px;"></textarea> <input type="date" id="ncrCorrectiveActionDeadlineInput" class="app-input" title="Prazo Ação Corretiva"> <select id="ncrStatusInput" class="app-select"><option value="aberta">Aberta</option><option value="em_analise">Em Análise</option><option value="acao_implementada">Ação Implementada</option><option value="verificacao_eficacia">Verificando Eficácia</option><option value="fechada">Fechada</option></select>`;
    
    // Como a função de fábrica não está disponível de forma limpa, vamos recriar a lógica aqui
    // Esta é uma correção para o problema de dependência circular.
    const { winId, appState } = createCustomQualityToolWindow('Relatório de Não Conformidade', 'ncr', formHTML, 'Não Conformidades Registradas', 'ncr', 2);

    appState.collectFormData = function() {
        const desc = this.formArea.querySelector('#ncrDescriptionInput').value.trim();
        if (!desc) {
            showNotification("Descrição é obrigatória.", 2000);
            return null;
        }
        return {
            description: desc,
            date: this.formArea.querySelector('#ncrDateInput').value,
            source: this.formArea.querySelector('#ncrSourceInput').value.trim(),
            severity: this.formArea.querySelector('#ncrSeverityInput').value,
            reportedBy: this.formArea.querySelector('#ncrReportedByInput').value.trim(),
            evidence: this.formArea.querySelector('#ncrEvidenceInput').value.trim(),
            immediateAction: this.formArea.querySelector('#ncrImmediateActionInput').value.trim(),
            correctiveAction: this.formArea.querySelector('#ncrCorrectiveActionInput').value.trim(),
            correctiveActionDeadline: this.formArea.querySelector('#ncrCorrectiveActionDeadlineInput').value,
            status: this.formArea.querySelector('#ncrStatusInput').value
        };
    };

    appState.populateForm = function(itemData) {
        this.formArea.querySelector('#ncrDescriptionInput').value = itemData.description || '';
        this.formArea.querySelector('#ncrDateInput').value = itemData.date || '';
        this.formArea.querySelector('#ncrSourceInput').value = itemData.source || '';
        this.formArea.querySelector('#ncrSeverityInput').value = itemData.severity || 'media';
        this.formArea.querySelector('#ncrReportedByInput').value = itemData.reportedBy || '';
        this.formArea.querySelector('#ncrEvidenceInput').value = itemData.evidence || '';
        this.formArea.querySelector('#ncrImmediateActionInput').value = itemData.immediateAction || '';
        this.formArea.querySelector('#ncrCorrectiveActionInput').value = itemData.correctiveAction || '';
        this.formArea.querySelector('#ncrCorrectiveActionDeadlineInput').value = itemData.correctiveActionDeadline || '';
        this.formArea.querySelector('#ncrStatusInput').value = itemData.status || 'aberta';
    };

    appState.renderListItem = function(item, index) {
        const severityColors = { baixa: 'green', media: 'orange', alta: 'red', critica: 'darkred' };
        return `<li>
            <div class="item-details">
                <strong><i class="fas fa-exclamation-triangle" style="margin-right:8px; color:${severityColors[item.severity] || 'var(--secondary-text-color)'};"></i>${item.description}</strong>
                <small>Severidade: ${item.severity}, Data: ${item.date || 'N/D'}, Status: ${item.status}</small>
                <small>Origem: ${item.source || 'N/I'} | Reportado por: ${item.reportedBy || 'N/I'}</small>
                ${item.correctiveAction ? `<p><i>Ação: ${item.correctiveAction.substring(0,100)}...</i></p>` : ''}
            </div>
            <div class="item-actions">
                <button class="app-button secondary action-button" data-action="edit" data-index="${index}"><i class="fas fa-edit"></i></button>
                <button class="app-button danger action-button" data-action="delete" data-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
        </li>`;
    };
    
    return winId;
}

// Uma implementação autônoma da função de fábrica para evitar dependência circular.
import { generateId } from '../main.js';
import { getStandardAppToolbarHTML as getToolbar, initializeFileState, setupAppToolbarActions as setupActions } from './app.js';

function createCustomQualityToolWindow(toolName, appType, formHTML, listTitle, fileNameSuffix, formGridCols = 1) {
    const uniqueSuffix = generateId(appType);
    const winId = window.windowManager.createWindow(toolName, '', { width: '850px', height: '700px', appType: `quality-tool ${appType}` });
    const winData = window.windowManager.windows.get(winId); if (!winData) return {winId: null, appState: null};
    const content = `
        <div class="app-toolbar"> ${getToolbar()} </div>
        <div class="quality-tool-content-area">
            <div class="quality-tool-form-section">
                <h4><i class="fas fa-edit"></i> <span id="formTitle_${uniqueSuffix}">Novo: ${toolName}</span></h4>
                <input type="hidden" id="editingItemId_${uniqueSuffix}" value="">
                <div class="form-grid" id="formArea_${uniqueSuffix}" style="grid-template-columns: repeat(${formGridCols}, 1fr);"> ${formHTML} </div>
                <div style="margin-top:10px;">
                    <button id="addItem${appType}Btn_${uniqueSuffix}" class="app-button"><i class="fas fa-plus"></i> Adicionar</button>
                    <button id="updateItem${appType}Btn_${uniqueSuffix}" class="app-button" style="display:none;"><i class="fas fa-save"></i> Atualizar</button>
                    <button id="cancelEdit${appType}Btn_${uniqueSuffix}" class="app-button secondary" style="display:none; margin-left: 8px;"><i class="fas fa-times"></i> Cancelar</button>
                </div>
            </div>
            <div class="quality-tool-list-section"> <h4><i class="fas fa-list-ul"></i> ${listTitle}</h4> <ul id="list${appType}_${uniqueSuffix}"></ul> </div>
        </div>`;
    winData.element.querySelector('.window-content').innerHTML = content;
    
    const appState = {
        winId, items: [], appDataType: appType,
        formArea: winData.element.querySelector(`#formArea_${uniqueSuffix}`), 
        listUl: winData.element.querySelector(`#list${appType}_${uniqueSuffix}`), 
        addBtn: winData.element.querySelector(`#addItem${appType}Btn_${uniqueSuffix}`), 
        updateBtn: winData.element.querySelector(`#updateItem${appType}Btn_${uniqueSuffix}`), 
        cancelEditBtn: winData.element.querySelector(`#cancelEdit${appType}Btn_${uniqueSuffix}`), 
        editingItemIdInput: winData.element.querySelector(`#editingItemId_${uniqueSuffix}`), 
        formTitleSpan: winData.element.querySelector(`#formTitle_${uniqueSuffix}`), 
        originalToolName: toolName,
        getData: function() { return this.items; },
        loadData: function(dataString, fileMeta) { 
            try {
                const data = JSON.parse(dataString);
                this.items = Array.isArray(data) ? data : []; 
                this.fileId = fileMeta.id;
                this.markClean(); 
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
                this.renderList(); 
                this.clearForm();
            } catch(e) {
                showNotification(`Erro ao ler arquivo de ${toolName}.`, 3000);
            }
        },
        collectFormData: function() { return {}; }, 
        populateForm: function(itemData) {},
        clearForm: function() { this.formArea.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(input => { if (input.type === 'checkbox' || input.type === 'radio') input.checked = false; else if(input.tagName === 'SELECT') input.selectedIndex = 0; else input.value = ''; }); this.editingItemIdInput.value = ''; this.formTitleSpan.textContent = `Novo: ${this.originalToolName}`; this.addBtn.style.display = 'inline-block'; this.updateBtn.style.display = 'none'; this.cancelEditBtn.style.display = 'none'; },
        renderListItem: function(item, index) { return `<li>${JSON.stringify(item)}</li>`; },
        renderList: function() { this.listUl.innerHTML = ''; this.items.forEach((item, index) => { this.listUl.innerHTML += this.renderListItem(item, index); }); },
        addItem: function() { const newItemData = this.collectFormData(); if (newItemData) { this.items.push({...newItemData, id: generateId(appType) }); this.markDirty(); this.renderList(); this.clearForm(); } },
        updateItem: function() { const editingId = this.editingItemIdInput.value; if (!editingId) { this.clearForm(); return; } const itemIndex = this.items.findIndex(item => item.id === editingId); if (itemIndex === -1) { showNotification("Item não encontrado.", 3000); this.clearForm(); return; } const updatedData = this.collectFormData(); if (updatedData) { this.items[itemIndex] = {...this.items[itemIndex], ...updatedData }; this.markDirty(); this.renderList(); this.clearForm(); showNotification("Item atualizado.", 2000); } },
        editItem: function(index) { const itemData = this.items[index]; if (!itemData) return; this.populateForm(itemData); this.editingItemIdInput.value = itemData.id; this.formTitleSpan.textContent = `Editando: ${this.originalToolName} (ID: ${itemData.id.slice(-5)})`; this.addBtn.style.display = 'none'; this.updateBtn.style.display = 'inline-block'; this.cancelEditBtn.style.display = 'inline-block'; this.formArea.querySelector('input, textarea, select')?.focus(); },
        init: function() { 
            setupActions(this);
            this.addBtn.onclick = () => this.addItem(); 
            this.updateBtn.onclick = () => this.updateItem(); 
            this.cancelEditBtn.onclick = () => this.clearForm(); 
            this.listUl.addEventListener('click', (e) => { 
                const button = e.target.closest('button.action-button'); 
                if(!button) return; 
                const action = button.dataset.action; 
                const index = parseInt(button.dataset.index); 
                if(action === "delete") { 
                    if(confirm("Tem certeza que deseja excluir?")) { 
                        const itemIdToDelete = this.items[index]?.id; 
                        this.items.splice(index, 1); 
                        this.markDirty(); 
                        this.renderList(); 
                        if(this.editingItemIdInput.value === itemIdToDelete) this.clearForm(); 
                    } 
                } else if (action === "edit") { 
                    this.editItem(index); 
                } 
            }); 
            this.renderList(); 
        },
        cleanup: () => {}
    };
    initializeFileState(appState, toolName, `novo_${fileNameSuffix}.${fileNameSuffix}`, appType); 
    winData.currentAppInstance = appState;
    setTimeout(() => winData.currentAppInstance?.init(), 0);
    return { winId, appState };
}