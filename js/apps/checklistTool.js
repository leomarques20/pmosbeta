import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

// Função de fábrica para criar a base das ferramentas da qualidade
function createQualityToolWindow(toolName, appType, formHTML, listTitle, fileNameSuffix, formGridCols = 1) {
    const uniqueSuffix = generateId(appType);
    const winId = window.windowManager.createWindow(toolName, '', { width: '850px', height: '700px', appType: `quality-tool ${appType}` });
    const winData = window.windowManager.windows.get(winId); if (!winData) return winId;
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

export function openChecklistTool() {
    const formHTML = `<input type="text" id="checklistItemInput" class="app-input" placeholder="Item do Checklist (ex: Verificar documentação X)"> <select id="checklistCategoryInput" class="app-select"><option value="">Categoria (Opcional)</option> <option value="documentacao">Documentação</option><option value="processo">Processo</option> <option value="seguranca">Segurança</option><option value="outro">Outro</option></select><select id="checklistStatusInput" class="app-select"><option value="pendente">Pendente</option> <option value="conforme">Conforme</option> <option value="nao_conforme">Não Conforme</option> <option value="na">N/A</option></select><input type="text" id="checklistResponsibleInput" class="app-input" placeholder="Responsável (Opcional)"><textarea id="checklistNotesInput" class="app-textarea" placeholder="Observações..." style="min-height:60px; grid-column: span 2;"></textarea>`;
    const { winId, appState } = createQualityToolWindow('Checklist', 'checklist', formHTML, 'Itens do Checklist', 'checklist', 2);
    
    appState.collectFormData = function() { const itemText = this.formArea.querySelector('#checklistItemInput').value.trim(); if (!itemText) { showNotification("Descreva o item.", 2000); return null;} return { text: itemText, category: this.formArea.querySelector('#checklistCategoryInput').value, status: this.formArea.querySelector('#checklistStatusInput').value, responsible: this.formArea.querySelector('#checklistResponsibleInput').value.trim(), notes: this.formArea.querySelector('#checklistNotesInput').value.trim() }; };
    appState.populateForm = function(itemData) { this.formArea.querySelector('#checklistItemInput').value = itemData.text || ''; this.formArea.querySelector('#checklistCategoryInput').value = itemData.category || ''; this.formArea.querySelector('#checklistStatusInput').value = itemData.status || 'pendente'; this.formArea.querySelector('#checklistResponsibleInput').value = itemData.responsible || ''; this.formArea.querySelector('#checklistNotesInput').value = itemData.notes || ''; };
    appState.renderListItem = function(item, index) { const icons = {pendente: 'fa-clock', conforme: 'fa-check-circle', nao_conforme: 'fa-times-circle', na: 'fa-minus-circle'}; const iconClass = icons[item.status] || 'fa-question-circle'; return `<li> <div class="item-details"> <strong><i class="fas ${iconClass}" style="margin-right:8px; color: ${item.status === 'conforme' ? 'green' : (item.status === 'nao_conforme' ? 'red' : 'var(--secondary-text-color)')};"></i>${item.text}</strong> <small>Status: ${item.status} ${item.category ? `| Cat: ${item.category}` : ''} ${item.responsible ? `| Resp: ${item.responsible}`: ''}</small> ${item.notes ? `<p><i>Obs: ${item.notes}</i></p>` : ''} </div> <div class="item-actions"> <button class="app-button secondary action-button" data-action="edit" data-index="${index}"><i class="fas fa-edit"></i></button> <button class="app-button danger action-button" data-action="delete" data-index="${index}"><i class="fas fa-trash"></i></button> </div> </li>`; };
    
    return winId;
}