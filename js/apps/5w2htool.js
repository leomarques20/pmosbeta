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

export function open5W2HTool() {
    const formHTML = `<input type="text" id="w5h2WhatInput" class="app-input" placeholder="O Quê será feito? (What)" style="grid-column: span 2;"> <textarea id="w5h2WhyInput" class="app-textarea" placeholder="Por Quê será feito? (Why)" style="grid-column: span 2; min-height:60px;"></textarea> <input type="text" id="w5h2WhereInput" class="app-input" placeholder="Onde? (Where)"> <input type="text" id="w5h2WhenInput" class="app-input" placeholder="Quando? (When - ex: data, prazo)"> <input type="text" id="w5h2WhoInput" class="app-input" placeholder="Quem? (Who - responsável)"> <input type="text" id="w5h2HowInput" class="app-input" placeholder="Como? (How - método, etapas)" style="grid-column: span 2;"> <input type="number" id="w5h2HowMuchInput" class="app-input" placeholder="Quanto custará? (How Much)" step="0.01"> <select id="w5h2StatusInput" class="app-select"><option value="planejado">Planejado</option><option value="em_andamento">Em Andamento</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option><option value="aguardando">Aguardando</option></select>`;
    const { winId, appState } = createCustomQualityToolWindow('Ferramenta 5W2H', '5w2h', formHTML, 'Planos de Ação 5W2H', '5w2h', 2);

    appState.collectFormData = function() {
        const what = this.formArea.querySelector('#w5h2WhatInput').value.trim();
        if (!what) {
            showNotification("'O Quê?' é obrigatório.", 2000);
            return null;
        }
        return {
            what: what,
            why: this.formArea.querySelector('#w5h2WhyInput').value.trim(),
            where: this.formArea.querySelector('#w5h2WhereInput').value.trim(),
            when: this.formArea.querySelector('#w5h2WhenInput').value.trim(),
            who: this.formArea.querySelector('#w5h2WhoInput').value.trim(),
            how: this.formArea.querySelector('#w5h2HowInput').value.trim(),
            howMuch: parseFloat(this.formArea.querySelector('#w5h2HowMuchInput').value) || 0,
            status: this.formArea.querySelector('#w5h2StatusInput').value
        };
    };

    appState.populateForm = function(itemData) {
        this.formArea.querySelector('#w5h2WhatInput').value = itemData.what || '';
        this.formArea.querySelector('#w5h2WhyInput').value = itemData.why || '';
        this.formArea.querySelector('#w5h2WhereInput').value = itemData.where || '';
        this.formArea.querySelector('#w5h2WhenInput').value = itemData.when || '';
        this.formArea.querySelector('#w5h2WhoInput').value = itemData.who || '';
        this.formArea.querySelector('#w5h2HowInput').value = itemData.how || '';
        this.formArea.querySelector('#w5h2HowMuchInput').value = itemData.howMuch || 0;
        this.formArea.querySelector('#w5h2StatusInput').value = itemData.status || 'planejado';
    };

    appState.renderListItem = function(item, index) {
        const statusIcons = { planejado: 'fa-calendar-alt', em_andamento: 'fa-spinner fa-spin', concluido: 'fa-check-circle', cancelado: 'fa-ban', aguardando: 'fa-pause-circle' };
        const icon = statusIcons[item.status] || 'fa-question';
        return `<li>
            <div class="item-details">
                <strong><i class="fas ${icon}" style="margin-right:8px;"></i>${item.what}</strong>
                <small>Quem: ${item.who || 'N/I'} | Quando: ${item.when || 'N/I'} | Custo: R$ ${item.howMuch.toFixed(2)} | Status: ${item.status}</small>
                <details style="margin-top:5px;">
                    <summary>Ver Detalhes</summary>
                    <p><strong>Porquê:</strong> ${item.why || 'N/I'}</p>
                    <p><strong>Onde:</strong> ${item.where || 'N/I'}</p>
                    <p><strong>Como:</strong> ${item.how || 'N/I'}</p>
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
