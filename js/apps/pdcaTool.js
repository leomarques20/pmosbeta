import { showNotification, generateId } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

// Função de fábrica autônoma para ferramentas da qualidade
function createCustomQualityToolWindow(toolName, appType, formHTML, listTitle, fileNameSuffix, formGridCols = 1) {
    const uniqueSuffix = generateId(appType);
    const winId = window.windowManager.createWindow(toolName, '', { width: '850px', height: '700px', appType: `quality-tool ${appType}` });
    const winData = window.windowManager.windows.get(winId); if (!winData) return {winId: null, appState: null};
    const content = `
        <div class="app-toolbar"> ${getStandardAppToolbarHTML()} </div>
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
            setupAppToolbarActions(this);
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


export function openPDCATool() {
    const formHTML = `<input type="text" id="pdcaTitleInput" class="app-input" placeholder="Título da Iniciativa/Problema" style="grid-column: span 2;"> <textarea id="pdcaPlanInput" class="app-textarea" placeholder="Planejar (Plan)..." style="min-height:80px; grid-column: span 2;"></textarea> <textarea id="pdcaDoInput" class="app-textarea" placeholder="Executar (Do)..." style="min-height:80px; grid-column: span 2;"></textarea> <textarea id="pdcaCheckInput" class="app-textarea" placeholder="Verificar (Check)..." style="min-height:80px; grid-column: span 2;"></textarea> <textarea id="pdcaActInput" class="app-textarea" placeholder="Agir (Act)..." style="min-height:80px; grid-column: span 2;"></textarea> <input type="text" id="pdcaResponsibleInput" class="app-input" placeholder="Responsável"> <input type="date" id="pdcaStartDateInput" class="app-input" title="Data de Início"> <select id="pdcaStatusInput" class="app-select"><option value="planejamento">Planejamento</option><option value="execucao">Execução</option><option value="verificacao">Verificação</option><option value="acao">Ação</option><option value="concluido">Concluído</option><option value="suspenso">Suspenso</option></select>`;
    const { winId, appState } = createCustomQualityToolWindow('Ciclo PDCA', 'pdca', formHTML, 'Iniciativas PDCA', 'pdca', 2);

    appState.collectFormData = function() {
        const title = this.formArea.querySelector('#pdcaTitleInput').value.trim();
        if (!title) {
            showNotification("Título é obrigatório.", 2000);
            return null;
        }
        return {
            title,
            plan: this.formArea.querySelector('#pdcaPlanInput').value.trim(),
            do: this.formArea.querySelector('#pdcaDoInput').value.trim(),
            check: this.formArea.querySelector('#pdcaCheckInput').value.trim(),
            act: this.formArea.querySelector('#pdcaActInput').value.trim(),
            responsible: this.formArea.querySelector('#pdcaResponsibleInput').value.trim(),
            startDate: this.formArea.querySelector('#pdcaStartDateInput').value,
            status: this.formArea.querySelector('#pdcaStatusInput').value
        };
    };

    appState.populateForm = function(itemData) {
        this.formArea.querySelector('#pdcaTitleInput').value = itemData.title || '';
        this.formArea.querySelector('#pdcaPlanInput').value = itemData.plan || '';
        this.formArea.querySelector('#pdcaDoInput').value = itemData.do || '';
        this.formArea.querySelector('#pdcaCheckInput').value = itemData.check || '';
        this.formArea.querySelector('#pdcaActInput').value = itemData.act || '';
        this.formArea.querySelector('#pdcaResponsibleInput').value = itemData.responsible || '';
        this.formArea.querySelector('#pdcaStartDateInput').value = itemData.startDate || '';
        this.formArea.querySelector('#pdcaStatusInput').value = itemData.status || 'planejamento';
    };

    appState.renderListItem = function(item, index) {
        const statusIcons = { planejamento: 'fa-clipboard-list', execucao: 'fa-running', verificacao: 'fa-search', acao: 'fa-cogs', concluido: 'fa-check-double', suspenso: 'fa-pause-circle' };
        const icon = statusIcons[item.status] || 'fa-spinner';
        return `<li>
            <div class="item-details">
                <strong><i class="fas ${icon}" style="margin-right:8px;"></i>${item.title}</strong>
                <small>Status: ${item.status}, Início: ${item.startDate || 'N/D'}, Resp: ${item.responsible || 'N/I'}</small>
                <details style="margin-top:5px;">
                    <summary>Ver Detalhes</summary>
                    <p><strong>Plan:</strong> ${item.plan?.substring(0,150)}...</p>
                    <p><strong>Do:</strong> ${item.do?.substring(0,150)}...</p>
                    <p><strong>Check:</strong> ${item.check?.substring(0,150)}...</p>
                    <p><strong>Act:</strong> ${item.act?.substring(0,150)}...</p>
                </details>
            </div>
            <div class="item-actions">
                <button class="app-button secondary action-button" data-action="edit" data-index="${index}"><i class="fas fa-edit"></i></button>
                <button class="app-button danger action-button" data-action="delete" data-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
        </li>`;
    };
    
    return winId;
}