import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openSIPOCMatrix() {
    const uniqueSuffix = generateId('sipoc');
    const winId = window.windowManager.createWindow('Matriz SIPOC', '', { width: '1100px', height: '600px', appType: 'sipoc-matrix' });
    const content = `
        <div class="app-toolbar sipoc-toolbar">
            ${getStandardAppToolbarHTML()}
            <input type="text" id="sipocProcessName_${uniqueSuffix}" class="app-input" placeholder="Nome do Processo Principal" style="margin-left: auto; width: 300px;">
        </div>
        <div class="sipoc-main-content" id="sipocMainContent_${uniqueSuffix}"></div>`;
    const winData = window.windowManager.windows.get(winId); if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;
    
    const appState = {
        winId, appDataType: 'sipoc-matrix',
        sipocData: { processName: "", suppliers: [], inputs: [], process: [], outputs: [], customers: [] },
        mainContentEl: winData.element.querySelector(`#sipocMainContent_${uniqueSuffix}`), 
        processNameInput: winData.element.querySelector(`#sipocProcessName_${uniqueSuffix}`),
        getData: function() { this.sipocData.processName = this.processNameInput.value; return this.sipocData; },
        loadData: function(dataString, fileMeta) { 
            try { 
                const data = JSON.parse(dataString);
                this.sipocData = data || { processName: "", suppliers: [], inputs: [], process: [], outputs: [], customers: [] }; 
                ['suppliers', 'inputs', 'process', 'outputs', 'customers'].forEach(key => { 
                    this.sipocData[key] = (this.sipocData[key] || []).map(item => (typeof item === 'string') ? {id: generateId('sipocItem'), text: item} : {...item, id: item.id || generateId('sipocItem')}); 
                }); 
                this.fileId = fileMeta.id; 
                this.markClean(); 
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
                this.renderSIPOC();
            } catch (e) { 
                showNotification("Erro ao ler arquivo SIPOC.", 3000); 
            } 
        },
        init: function() { 
            setupAppToolbarActions(this);
            this.processNameInput.oninput = () => { this.markDirty(); this.sipocData.processName = this.processNameInput.value; }; 
            this.mainContentEl.addEventListener('click', (e) => this.handleSipocClick(e)); 
            this.mainContentEl.addEventListener('input', (e) => this.handleSipocInput(e)); 
            this.renderSIPOC(); 
        },
        renderSIPOC: function() { this.mainContentEl.innerHTML = ''; this.processNameInput.value = this.sipocData.processName; const columns = [ { key: 'suppliers', title: 'Fornecedores (S)', icon: 'fa-truck' }, { key: 'inputs', title: 'Entradas (I)', icon: 'fa-sign-in-alt' }, { key: 'process', title: 'Processo (P)', icon: 'fa-cogs' }, { key: 'outputs', title: 'Saídas (O)', icon: 'fa-sign-out-alt' }, { key: 'customers', title: 'Clientes (C)', icon: 'fa-users' }]; columns.forEach(col => { const colEl = document.createElement('div'); colEl.className = 'sipoc-column'; colEl.dataset.columnKey = col.key; colEl.innerHTML = `<h3><i class="fas ${col.icon}"></i> ${col.title}</h3> <ul class="sipoc-items-list"></ul> <button class="app-button secondary small-add-item" data-action="add-item"><i class="fas fa-plus"></i> Item</button>`; const itemsListUl = colEl.querySelector('.sipoc-items-list'); (this.sipocData[col.key] || []).forEach(item => this.renderSipocItem(itemsListUl, item)); this.mainContentEl.appendChild(colEl); }); },
        renderSipocItem: function(listUl, itemData) { const itemLi = document.createElement('li'); itemLi.className = 'sipoc-item'; itemLi.dataset.itemId = itemData.id; itemLi.innerHTML = `<input type="text" class="app-input" value="${itemData.text}" placeholder="..."><button class="app-button danger small-action" data-action="delete-item" title="Excluir"><i class="fas fa-times"></i></button>`; listUl.appendChild(itemLi); },
        addItemToColumn: function(columnKey) { if (!this.sipocData[columnKey]) this.sipocData[columnKey] = []; this.sipocData[columnKey].push({ id: generateId('sipocItem'), text: "" }); this.markDirty(); this.renderSIPOC(); },
        deleteSipocItem: function(columnKey, itemId) { if (this.sipocData[columnKey]) { this.sipocData[columnKey] = this.sipocData[columnKey].filter(item => item.id !== itemId); this.markDirty(); this.renderSIPOC(); } },
        updateSipocItemText: function(columnKey, itemId, newText) { if (this.sipocData[columnKey]) { const item = this.sipocData[columnKey].find(i => i.id === itemId); if (item) { item.text = newText; this.markDirty(); } } },
        handleSipocClick: function(e) { const button = e.target.closest('button[data-action]'); if (!button) return; const action = button.dataset.action; const columnEl = button.closest('.sipoc-column'); const columnKey = columnEl?.dataset.columnKey; const itemEl = button.closest('.sipoc-item'); const itemId = itemEl?.dataset.itemId; if (action === 'add-item') this.addItemToColumn(columnKey); else if (action === 'delete-item') this.deleteSipocItem(columnKey, itemId); },
        handleSipocInput: function(e) { if (e.target.tagName === 'INPUT' && e.target.closest('.sipoc-item')) { const itemEl = e.target.closest('.sipoc-item'); const itemId = itemEl.dataset.itemId; const columnEl = itemEl.closest('.sipoc-column'); const columnKey = columnEl.dataset.columnKey; this.updateSipocItemText(columnKey, itemId, e.target.value); } },
        cleanup: () => {}
    };
    initializeFileState(appState, "Nova Matriz SIPOC", "matriz.sipoc", "sipoc-matrix");
    winData.currentAppInstance = appState;
    appState.init();
    return winId;
}