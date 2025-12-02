import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openKanbanBoard() {
    const uniqueSuffix = generateId('kanban');
    const winId = window.windowManager.createWindow('Quadro Kanban', '', { width: '1200px', height: '750px', appType: 'kanban-board' });
    const content = `
        <style>
            /* Kanban App Specific Styles */
            .kanban-board-app-container { padding: 0 !important; background-color: #f5f7fa; }
            .dark-mode .kanban-board-app-container { background-color: #252936; }
            .kanban-board-app { display: flex; flex-direction: column; height: 100%; }
            .kanban-board { display: flex; padding: 20px; gap: 20px; overflow-x: auto; flex-grow: 1; -webkit-overflow-scrolling: touch; }
            .kanban-column { background: var(--input-bg); border-radius: 12px; min-width: 320px; max-width: 320px; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid var(--separator-color); }
            .dark-mode .kanban-column { background: #2c3140; }
            .column-header { padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--separator-color); gap: 10px;}
            .column-title { font-weight: 600; font-size: 1.1rem; color: var(--text-color); cursor: pointer; flex-grow: 1; padding: 5px 0;}
            .column-actions .action-btn { width: 30px; height: 30px; border-radius: 50%; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--secondary-text-color); transition: all 0.2s; }
            .column-actions .action-btn:hover { background: var(--hover-highlight-color); color: var(--danger-color); }
            .cards-container { padding: 15px; flex-grow: 1; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; min-height: 100px; }
            .cards-container.drag-over { background: var(--accent-light-translucent); outline: 2px dashed var(--accent-color); }
            .kanban-card { background: var(--window-bg); border-radius: 8px; padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.07); cursor: grab; transition: all 0.2s; border-left: 5px solid var(--secondary-text-color); user-select: none; }
            .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .kanban-card.high-priority { border-left-color: #dc3545; }
            .kanban-card.medium-priority { border-left-color: #ffc107; }
            .kanban-card.low-priority { border-left-color: #28a745; }
            .card-header { margin-bottom: 10px; }
            .card-title { font-weight: 600; font-size: 1.05rem; }
            .card-description { color: var(--secondary-text-color); font-size: 0.9rem; line-height: 1.5; margin-bottom: 15px; white-space: pre-wrap; }
            .card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--secondary-text-color); margin-bottom: 12px; }
            .card-due-date, .card-assignee { display: flex; align-items: center; gap: 6px; }
            .card-tags { display: flex; flex-wrap: wrap; gap: 8px; }
            .card-tag { font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.05); }
            .dark-mode .card-tag { border-color: rgba(255,255,255,0.1); }
            .modal-tag .remove-tag { cursor: pointer; margin-left: 6px; font-weight: bold; opacity: 0.7; }
            .modal-tag .remove-tag:hover { opacity: 1; }
            .add-card-btn { margin: 0 10px 10px 10px; padding: 10px; border-radius: 6px; border: 1px dashed var(--input-border-color); background: transparent; color: var(--secondary-text-color); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
            .add-card-btn:hover { border-color: var(--accent-color); color: var(--accent-color); background: var(--hover-highlight-color); }
            .kanban-card.dragging { opacity: 0.5; transform: rotate(3deg); }
            .kanban-card.touch-ghost { position: absolute; z-index: 1000; pointer-events: none; opacity: 0.8; transform: rotate(5deg); box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
            .kanban-card.touch-dragging { opacity: 0.4; }
            .color-picker-input { padding: 0; height: 38px; width: 50px; border: 1px solid var(--input-border-color); border-radius: 6px; cursor: pointer; background-color: transparent; }
            #tagManagerList_${uniqueSuffix} { list-style: none; padding: 0; margin: 0; max-height: 300px; overflow-y: auto; }
            #tagManagerList_${uniqueSuffix} li { display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid var(--separator-color); }
            #tagManagerList_${uniqueSuffix} li:last-child { border-bottom: none; }
            .tag-manager-actions { margin-left: auto; display: flex; gap: 8px; }
            .column-title-input { width: 100%; font-size: 1.1rem; font-weight: 600; border: 1px solid var(--accent-color); margin: 0; }
            .column-drag-handle { cursor: grab; color: var(--secondary-text-color); opacity: 0.5; transition: opacity 0.2s; padding: 5px; }
            .column-drag-handle:hover { opacity: 1; }
            .kanban-column.column-dragging { opacity: 0.4; background: var(--hover-highlight-color); border-style: dashed; }
            .column-placeholder { border: 2px dashed var(--accent-color); background: var(--accent-light-translucent); border-radius: 12px; min-width: 320px; max-width: 320px; flex-shrink: 0; margin: 0; }
        </style>
        
        <div class="app-toolbar kanban-toolbar">
             ${getStandardAppToolbarHTML()}
            <div class="toolbar-group" style="margin-left: auto;">
                <button id="manageTagsBtn_${uniqueSuffix}" class="app-button secondary"><i class="fas fa-tags"></i> Gerenciar Tags</button>
                <button id="addColumnBtn_${uniqueSuffix}" class="app-button secondary"><i class="fas fa-plus"></i> Nova Coluna</button>
            </div>
            <div class="search-box" style="position: relative;">
                <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--secondary-text-color);"></i>
                <input type="text" id="searchInput_${uniqueSuffix}" class="app-input" placeholder="Buscar tarefas..." style="margin-bottom:0; width: 250px; padding-left: 35px;">
            </div>
        </div>
        <div class="kanban-board" id="kanbanBoard_${uniqueSuffix}"></div>

        <div class="modal-overlay" id="cardModal_${uniqueSuffix}" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 100;">
            <div class="modal-content" style="background: var(--window-bg); border-radius: 12px; width: 100%; max-width: 600px; box-shadow: var(--shadow); display: flex; flex-direction: column;">
                <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--separator-color); display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="modal-title" style="font-size: 1.3rem; font-weight: 600;">Editar Tarefa</h3>
                    <button class="modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--secondary-text-color);">×</button>
                </div>
                <div class="modal-body" style="padding: 25px; overflow-y: auto;">
                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="form-group" style="grid-column: span 2;"><label>Título</label><input type="text" class="app-input" id="cardTitleInput"></div>
                        <div class="form-group"><label>Prioridade</label><select class="app-select" id="cardPriorityInput"><option value="low">Baixa</option><option value="medium" selected>Média</option><option value="high">Alta</option></select></div>
                        <div class="form-group"><label>Data de Vencimento</label><input type="date" class="app-input" id="cardDueDateInput"></div>
                        <div class="form-group" style="grid-column: span 2;"><label>Responsável</label><input type="text" class="app-input" id="cardAssigneeInput"></div>
                        <div class="form-group" style="grid-column: span 2;"><label>Descrição</label><textarea class="app-textarea" id="cardDescriptionInput" rows="4"></textarea></div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Tags</label>
                            <div id="cardTagsContainer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; padding: 5px 0; min-height: 20px;"></div>
                            <label style="margin-top: 15px;">Adicionar Tag</label>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <select class="app-select" id="existingTagSelect" style="flex-grow: 1; margin: 0;"><option value="">Selecionar existente...</option></select>
                                <button class="app-button secondary" id="addExistingTagBtn" type="button" style="padding: 8px 12px;">Add</button>
                            </div>
                            <label style="margin-top: 10px;">Criar Nova Tag</label>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" class="app-input" id="newTagTextInput" placeholder="Nova tag..." style="flex-grow: 1; margin: 0;">
                                <input type="color" id="newTagColorInput" class="color-picker-input" value="#cccccc">
                                <button class="app-button secondary" id="createNewTagBtn" type="button" style="padding: 8px 12px;">Criar</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="form-footer" style="display: flex; justify-content: flex-end; gap: 12px; padding: 20px; border-top: 1px solid var(--separator-color); margin-top: auto;">
                    <button class="app-button secondary modal-cancel-btn">Cancelar</button>
                    <button class="app-button modal-save-btn">Salvar Alterações</button>
                </div>
            </div>
        </div>
        <div class="modal-overlay" id="tagManagerModal_${uniqueSuffix}" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 101;">
            <div class="modal-content" style="background: var(--window-bg); border-radius: 12px; width: 100%; max-width: 500px; box-shadow: var(--shadow); display: flex; flex-direction: column;">
                <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--separator-color); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="font-size: 1.3rem; font-weight: 600;">Gerenciar Tags</h3>
                    <button class="modal-close" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--secondary-text-color);">×</button>
                </div>
                <div class="modal-body" style="padding: 25px;">
                    <ul id="tagManagerList_${uniqueSuffix}"></ul>
                </div>
                <div class="form-footer" style="display: flex; justify-content: flex-end; gap: 12px; padding: 20px; border-top: 1px solid var(--separator-color);">
                     <button class="app-button tag-manager-close-btn">Fechar</button>
                </div>
            </div>
        </div>
    `;

    const winData = window.windowManager.windows.get(winId); if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;
    
    const appState = {
        winId,
        appDataType: 'kanban-board',
        boardData: { columns: [], tags: [] },
        editingCardId: null,
        editingColumnId: null,
        
        boardEl: winData.element.querySelector(`#kanbanBoard_${uniqueSuffix}`),
        searchInput: winData.element.querySelector(`#searchInput_${uniqueSuffix}`),
        addColumnBtn: winData.element.querySelector(`#addColumnBtn_${uniqueSuffix}`),
        
        cardModal: {
            overlay: winData.element.querySelector(`#cardModal_${uniqueSuffix}`),
            title: winData.element.querySelector(`#cardTitleInput`),
            priority: winData.element.querySelector(`#cardPriorityInput`),
            dueDate: winData.element.querySelector(`#cardDueDateInput`),
            assignee: winData.element.querySelector(`#cardAssigneeInput`),
            description: winData.element.querySelector(`#cardDescriptionInput`),
            tagsContainer: winData.element.querySelector('#cardTagsContainer'),
            existingTagSelect: winData.element.querySelector('#existingTagSelect'),
            addExistingTagBtn: winData.element.querySelector('#addExistingTagBtn'),
            newTagText: winData.element.querySelector('#newTagTextInput'),
            newTagColor: winData.element.querySelector('#newTagColorInput'),
            createNewTagBtn: winData.element.querySelector('#createNewTagBtn'),
            saveBtn: winData.element.querySelector(`#cardModal_${uniqueSuffix} .modal-save-btn`),
            cancelBtn: winData.element.querySelector(`#cardModal_${uniqueSuffix} .modal-cancel-btn`),
            closeBtn: winData.element.querySelector(`#cardModal_${uniqueSuffix} .modal-close`),
        },

        tagManager: {
            btn: winData.element.querySelector(`#manageTagsBtn_${uniqueSuffix}`),
            overlay: winData.element.querySelector(`#tagManagerModal_${uniqueSuffix}`),
            list: winData.element.querySelector(`#tagManagerList_${uniqueSuffix}`),
            closeBtn: winData.element.querySelector(`#tagManagerModal_${uniqueSuffix} .modal-close`),
            footerCloseBtn: winData.element.querySelector(`#tagManagerModal_${uniqueSuffix} .tag-manager-close-btn`),
        },

        draggedCardEl: null,
        sourceColumnId: null,
        draggedColumnEl: null,
        placeholderEl: null,

        getContrastColor: function(hexcolor) {
            if (hexcolor.slice(0, 1) === '#') { hexcolor = hexcolor.slice(1); }
            const r = parseInt(hexcolor.substr(0, 2), 16);
            const g = parseInt(hexcolor.substr(2, 2), 16);
            const b = parseInt(hexcolor.substr(4, 2), 16);
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            return (yiq >= 128) ? '#000000' : '#ffffff';
        },

        getData: function() { 
            return this.boardData; 
        },

        loadData: function(dataString, fileMeta) { 
            let data;
            try { 
                data = JSON.parse(dataString); 
            } catch (e) {
                showNotification("Erro ao ler arquivo Kanban.", 3000); 
                this.loadDefaultBoard(); 
                this.renderBoard(); 
                return;
            }
            
            if (data && !data.tags) {
                const globalTags = new Map();
                let nextTagId = 1;
                (data.columns || []).forEach(col => {
                    (col.cards || []).forEach(card => {
                        const newTagIds = [];
                        (card.tags || []).forEach(oldTag => {
                            const tagKey = `${oldTag.text.toLowerCase()}|${oldTag.color}`;
                            if (!globalTags.has(tagKey)) {
                                globalTags.set(tagKey, { 
                                    id: `tag-${nextTagId++}`, 
                                    text: oldTag.text, 
                                    color: oldTag.color === 'gray' ? '#cccccc' : oldTag.color 
                                });
                            }
                            newTagIds.push(globalTags.get(tagKey).id);
                        });
                        card.tags = newTagIds;
                    });
                });
                data.tags = Array.from(globalTags.values());
            }

            this.boardData = (data && Array.isArray(data.columns)) ? data : { columns: [], tags: [] };
            (this.boardData.columns || []).forEach(col => { 
                col.id = col.id || generateId('col'); 
                (col.cards || []).forEach(card => { card.id = card.id || generateId('card'); }); 
            }); 
            this.fileId = fileMeta.id; 
            this.markClean(); 
            window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
            this.renderBoard(); 
        },
        
        init: function() { 
            setupAppToolbarActions(this);
            this.addColumnBtn.onclick = () => this.addColumn(); 
            this.searchInput.oninput = () => this.filterBoard();
            
            this.cardModal.saveBtn.onclick = () => this.saveCard();
            this.cardModal.cancelBtn.onclick = () => this.closeCardModal();
            this.cardModal.closeBtn.onclick = () => this.closeCardModal();
            this.cardModal.tagsContainer.addEventListener('click', (e) => {
                if(e.target.classList.contains('remove-tag')) { e.target.parentElement.remove(); }
            });
            this.cardModal.addExistingTagBtn.onclick = () => this.addExistingTagToModal();
            this.cardModal.createNewTagBtn.onclick = () => this.createNewTagInModal();

            this.tagManager.btn.onclick = () => this.openTagManager();
            this.tagManager.closeBtn.onclick = () => this.closeTagManager();
            this.tagManager.footerCloseBtn.onclick = () => this.closeTagManager();
            this.tagManager.list.addEventListener('click', (e) => this.handleTagManagerClick(e));

            this.boardEl.addEventListener('click', (e) => this.handleBoardClick(e));
            this.boardEl.addEventListener('dblclick', (e) => this.handleColumnTitleDblClick(e));
            this.boardEl.addEventListener('dragstart', (e) => this.handleDragStart(e));
            this.boardEl.addEventListener('dragend', (e) => this.handleDragEnd(e));
            this.boardEl.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.boardEl.addEventListener('drop', (e) => this.handleDrop(e));
            this.boardEl.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.boardEl.addEventListener('mousedown', (e) => { if (e.target.closest('.kanban-card')) { e.target.closest('.kanban-card').setAttribute('draggable', true); } });
            this.boardEl.addEventListener('mouseup', (e) => { const card = e.target.closest('.kanban-card'); if (card && card.hasAttribute('draggable')) { card.setAttribute('draggable', false); } });
            this.boardEl.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            this.boardEl.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            this.boardEl.addEventListener('touchend', (e) => this.handleTouchEnd(e));

            if(!this.boardData.columns.length) this.loadDefaultBoard(); 
            this.renderBoard(); 
        },

        loadDefaultBoard: function() {
            this.boardData = {
                tags: [
                    { id: 'tag-1', text: 'Bug', color: '#dc3545' },
                    { id: 'tag-2', text: 'Feature', color: '#4a6cf7' },
                    { id: 'tag-3', text: 'Melhoria', color: '#28a745' }
                ],
                columns: [
                    { id: generateId('col'), title: 'A Fazer', cards: [] },
                    { id: generateId('col'), title: 'Em Andamento', cards: [] },
                    { id: generateId('col'), title: 'Concluído', cards: [] }
                ]
            };
        },
        
        renderBoard: function(filteredData = null) {
// Reset drag flags to ensure click works after modifications
this.isTouchDragging = false;
this.draggedCardEl = null;
this.draggedColumnEl = null;

            const dataToRender = filteredData || this.boardData;
            this.boardEl.innerHTML = '';
            dataToRender.columns.forEach(column => {
                const columnEl = document.createElement('div');
                columnEl.className = 'kanban-column';
                columnEl.dataset.columnId = column.id;
                
                const cardsHTML = column.cards.map(card => this.renderCard(card)).join('');

                columnEl.innerHTML = `
                    <div class="column-header">
                        <i class="fas fa-grip-vertical column-drag-handle" draggable="true" title="Arrastar para reordenar"></i>
                        <span class="column-title">${column.title}</span>
                        <div class="column-actions">
                            <button class="action-btn" data-action="delete-column" title="Excluir Coluna"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="cards-container">${cardsHTML}</div>
                    <button class="add-card-btn" data-action="add-card"><i class="fas fa-plus"></i> Adicionar Tarefa</button>
                `;
                this.boardEl.appendChild(columnEl);
            });
        },

        renderCard: function(card) {
            const priorityInfo = { high: 'high-priority', medium: 'medium-priority', low: 'low-priority' }[card.priority] || 'medium-priority';
            const formatDate = (dateString) => dateString ? new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Sem data';
            
            const tagsHTML = (card.tags || []).map(tagId => {
                const tag = this.boardData.tags.find(t => t.id === tagId);
                if (!tag) return '';
                const textColor = this.getContrastColor(tag.color);
                return `<span class="card-tag" style="background-color: ${tag.color}; color: ${textColor};">${tag.text}</span>`;
            }).join('');

            return `
                <div class="kanban-card ${priorityInfo}" data-card-id="${card.id}" draggable="false">
                    <div class="card-header"><span class="card-title">${card.title}</span></div>
                    ${card.description ? `<p class="card-description">${card.description}</p>` : ''}
                    <div class="card-meta">
                        <div class="card-due-date"><i class="far fa-calendar-alt"></i> ${formatDate(card.dueDate)}</div>
                        ${card.assignee ? `<div class="card-assignee"><i class="fas fa-user-circle"></i> ${card.assignee}</div>` : ''}
                    </div>
                    ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ''}
                </div>`;
        },

        handleColumnTitleDblClick: function(e) {
            const titleEl = e.target.closest('.column-title');
            if (!titleEl || this.boardEl.querySelector('.column-title-input')) return;

            const columnId = titleEl.closest('.kanban-column').dataset.columnId;
            const currentTitle = titleEl.textContent;

            const inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.className = 'app-input column-title-input';
            inputEl.value = currentTitle;

            titleEl.replaceWith(inputEl);
            inputEl.focus();
            inputEl.select();

            const saveOrCancel = (save) => {
                if (save) {
                    const newTitle = inputEl.value.trim();
                    const column = this.boardData.columns.find(c => c.id === columnId);
                    if (newTitle && column && column.title !== newTitle) {
                        column.title = newTitle;
                        this.markDirty();
                    }
                }
                this.renderBoard();
            };
            
            inputEl.addEventListener('blur', () => saveOrCancel(true));
            inputEl.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    evt.preventDefault();
                    saveOrCancel(true);
                } else if (evt.key === 'Escape') {
                    saveOrCancel(false);
                }
            });
        },

        openCardModal: function(cardId = null, columnId = null) {
            this.editingCardId = cardId;
            this.editingColumnId = columnId;
            let card = null;

            if (cardId) {
                for (const col of this.boardData.columns) {
                    const foundCard = col.cards.find(c => c.id === cardId);
                    if (foundCard) { card = foundCard; this.editingColumnId = col.id; break; }
                }
            }
            
            this.cardModal.overlay.style.display = 'flex';
            this.cardModal.title.value = card ? card.title : '';
            this.cardModal.priority.value = card ? card.priority : 'medium';
            this.cardModal.dueDate.value = card ? card.dueDate : '';
            this.cardModal.assignee.value = card ? card.assignee : '';
            this.cardModal.description.value = card ? card.description : '';
            
            const cardTagIds = card ? card.tags || [] : [];
            this.renderAppliedCardTags(cardTagIds);
            this.populateExistingTagsDropdown(cardTagIds);
        },
        
        closeCardModal: function() { 
            this.cardModal.overlay.style.display = 'none'; 
        },

        renderAppliedCardTags: function(tagIds) {
            this.cardModal.tagsContainer.innerHTML = '';
            tagIds.forEach(tagId => {
                const tagData = this.boardData.tags.find(t => t.id === tagId);
                if (!tagData) return;
                
                const tagEl = document.createElement('span');
                tagEl.className = 'card-tag modal-tag';
                tagEl.dataset.tagId = tagData.id;
                tagEl.textContent = tagData.text;
                const textColor = this.getContrastColor(tagData.color);
                tagEl.style.backgroundColor = tagData.color;
                tagEl.style.color = textColor;
                tagEl.innerHTML += ' <span class="remove-tag" title="Remover tag">×</span>';
                this.cardModal.tagsContainer.appendChild(tagEl);
            });
        },

        populateExistingTagsDropdown: function(appliedTagIds) {
            const select = this.cardModal.existingTagSelect;
            select.innerHTML = '<option value="">Selecionar existente...</option>';
            this.boardData.tags.forEach(tag => {
                if (!appliedTagIds.includes(tag.id)) {
                    const option = document.createElement('option');
                    option.value = tag.id;
                    option.textContent = tag.text;
                    select.appendChild(option);
                }
            });
        },
        
        addExistingTagToModal: function() {
            const selectedTagId = this.cardModal.existingTagSelect.value;
            if (!selectedTagId) return;

            const currentTagIds = Array.from(this.cardModal.tagsContainer.children).map(el => el.dataset.tagId);
            if (!currentTagIds.includes(selectedTagId)) {
                currentTagIds.push(selectedTagId);
                this.renderAppliedCardTags(currentTagIds);
                this.populateExistingTagsDropdown(currentTagIds);
            }
        },

        createNewTagInModal: function() {
            const text = this.cardModal.newTagText.value.trim();
            const color = this.cardModal.newTagColor.value;
            if (!text) {
                showNotification("O nome da tag não pode ser vazio.", 2000);
                return;
            }

            const newTag = { id: generateId('tag'), text, color };
            this.boardData.tags.push(newTag);
            this.markDirty();

            const currentTagIds = Array.from(this.cardModal.tagsContainer.children).map(el => el.dataset.tagId);
            currentTagIds.push(newTag.id);
            this.renderAppliedCardTags(currentTagIds);
            this.populateExistingTagsDropdown(currentTagIds);
            
            this.cardModal.newTagText.value = '';
            showNotification(`Tag "${text}" criada e adicionada.`, 2000);
        },

        saveCard: function() {
            const cardTags = Array.from(this.cardModal.tagsContainer.children).map(el => el.dataset.tagId);
            const cardData = {
                title: this.cardModal.title.value || 'Nova Tarefa',
                priority: this.cardModal.priority.value,
                dueDate: this.cardModal.dueDate.value,
                assignee: this.cardModal.assignee.value,
                description: this.cardModal.description.value,
                tags: cardTags
            };
            if (this.editingCardId) {
                const column = this.boardData.columns.find(col => col.id === this.editingColumnId);
                const cardIndex = column.cards.findIndex(c => c.id === this.editingCardId);
                if (cardIndex > -1) { column.cards[cardIndex] = { ...column.cards[cardIndex], ...cardData }; }
            } else {
                const column = this.boardData.columns.find(col => col.id === this.editingColumnId);
                if (column) { column.cards.push({ id: generateId('card'), ...cardData }); }
            }
            this.markDirty(); 
            this.closeCardModal(); 
            this.renderBoard();
        },
        
        openTagManager: function() {
            this.renderTagManager();
            this.tagManager.overlay.style.display = 'flex';
        },

        closeTagManager: function() {
            this.tagManager.overlay.style.display = 'none';
        },

        renderTagManager: function() {
            const list = this.tagManager.list;
            list.innerHTML = '';
            this.boardData.tags.forEach(tag => {
                const li = document.createElement('li');
                li.dataset.tagId = tag.id;
                const textColor = this.getContrastColor(tag.color);
                li.innerHTML = `
                    <span class="card-tag" style="background-color: ${tag.color}; color: ${textColor};">${tag.text}</span>
                    <span class="tag-text-display" style="flex-grow: 1;">${tag.text}</span>
                    <div class="tag-manager-actions">
                        <button class="app-button-icon" data-action="edit-tag" title="Editar Tag"><i class="fas fa-pencil-alt"></i></button>
                        <button class="app-button-icon danger" data-action="delete-tag" title="Excluir Tag"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                list.appendChild(li);
            });
        },

        handleTagManagerClick: function(e) {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;
            const action = actionBtn.dataset.action;
            const li = actionBtn.closest('li');
            const tagId = li.dataset.tagId;
            const tag = this.boardData.tags.find(t => t.id === tagId);

            if (action === 'delete-tag') {
                if (confirm(`Tem certeza que deseja excluir a tag "${tag.text}"? Ela será removida de todos os cards.`)) {
                    this.boardData.tags = this.boardData.tags.filter(t => t.id !== tagId);
                    this.boardData.columns.forEach(col => {
                        col.cards.forEach(card => {
                            card.tags = (card.tags || []).filter(id => id !== tagId);
                        });
                    });
                    this.markDirty();
                    this.renderTagManager();
                    this.renderBoard();
                }
            } else if (action === 'edit-tag') {
                li.innerHTML = `
                    <input type="color" value="${tag.color}" class="color-picker-input">
                    <input type="text" value="${tag.text}" class="app-input" style="flex-grow: 1; margin:0;">
                    <div class="tag-manager-actions">
                        <button class="app-button-icon" data-action="save-edit-tag" title="Salvar"><i class="fas fa-check"></i></button>
                        <button class="app-button-icon" data-action="cancel-edit-tag" title="Cancelar"><i class="fas fa-times"></i></button>
                    </div>
                `;
            } else if (action === 'save-edit-tag') {
                const newText = li.querySelector('input[type="text"]').value.trim();
                const newColor = li.querySelector('input[type="color"]').value;
                if (newText) {
                    tag.text = newText;
                    tag.color = newColor;
                    this.markDirty();
                    this.renderTagManager();
                    this.renderBoard();
                }
            } else if (action === 'cancel-edit-tag') {
                this.renderTagManager();
            }
        },

        handleBoardClick: function(e) {
            if (this.isTouchDragging || this.draggedCardEl || this.draggedColumnEl) return;
            const addCardBtn = e.target.closest('[data-action="add-card"]');
            const deleteColBtn = e.target.closest('[data-action="delete-column"]');
            const cardEl = e.target.closest('.kanban-card');
            if (addCardBtn) {
                const columnId = addCardBtn.closest('.kanban-column').dataset.columnId;
                this.openCardModal(null, columnId);
            } else if (deleteColBtn) {
                if (confirm("Tem certeza que deseja excluir esta coluna e todos os seus cartões?")) {
                    const columnId = deleteColBtn.closest('.kanban-column').dataset.columnId;
                    this.boardData.columns = this.boardData.columns.filter(c => c.id !== columnId);
                    this.markDirty();
                    this.renderBoard();
                }
            } else if (cardEl) {
                const cardId = cardEl.dataset.cardId;
                this.openCardModal(cardId);
            }
        },

        addColumn: function() { 
            const title = prompt("Nome da nova coluna:", "Nova Coluna"); 
            if (title) { 
                this.boardData.columns.push({ id: generateId('col'), title, cards: [] }); 
                this.markDirty(); 
                this.renderBoard(); 
            } 
        },

        filterBoard: function() {
            const query = this.searchInput.value.trim().toLowerCase();
            if (!query) { this.renderBoard(); return; }
            const filteredData = JSON.parse(JSON.stringify(this.boardData));
            filteredData.columns.forEach(col => {
                col.cards = col.cards.filter(card => {
                    const cardTags = (card.tags || []).map(tagId => this.boardData.tags.find(t => t.id === tagId)?.text || '').filter(Boolean);
                    return (card.title?.toLowerCase().includes(query)) ||
                           (card.description?.toLowerCase().includes(query)) ||
                           (card.assignee?.toLowerCase().includes(query)) ||
                           (cardTags.some(tagText => tagText.toLowerCase().includes(query)))
                });
            });
            this.renderBoard(filteredData);
        },
        
        handleDragStart: function(e) {
            if (e.target.classList.contains('column-drag-handle')) {
                this.draggedColumnEl = e.target.closest('.kanban-column');
                this.placeholderEl = document.createElement('div');
                this.placeholderEl.className = 'column-placeholder';
                this.placeholderEl.style.height = this.draggedColumnEl.offsetHeight + 'px';
                setTimeout(() => {
                    this.draggedColumnEl.classList.add('column-dragging');
                }, 0);
            } 
            else if (e.target.closest('.kanban-card') && e.target.closest('.kanban-card').draggable) { 
                this.draggedCardEl = e.target.closest('.kanban-card'); 
                this.sourceColumnId = this.draggedCardEl.closest('.kanban-column').dataset.columnId; 
                setTimeout(() => this.draggedCardEl.classList.add('dragging'), 0);
            }
        },

        handleDragOver: function(e) {
            e.preventDefault();
            if (this.draggedColumnEl) {
                const targetColumn = e.target.closest('.kanban-column');
                if (targetColumn && targetColumn !== this.draggedColumnEl && !this.placeholderEl.contains(targetColumn)) {
                    const rect = targetColumn.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;
                    if (e.clientX < midpoint) {
                        this.boardEl.insertBefore(this.placeholderEl, targetColumn);
                    } else {
                        this.boardEl.insertBefore(this.placeholderEl, targetColumn.nextSibling);
                    }
                }
            } 
            else if (this.draggedCardEl) {
                const columnContainer = e.target.closest('.cards-container'); 
                if (columnContainer) { 
                    columnContainer.classList.add('drag-over'); 
                }
            }
        },

        handleDragLeave: function(e) {
            if (e.target.classList.contains('cards-container')) {
                e.target.classList.remove('drag-over');
            }
        },

        handleDrop: function(e) {
            e.preventDefault();
            if (this.draggedColumnEl) {
                if (this.placeholderEl && this.placeholderEl.parentElement) {
                    this.placeholderEl.parentElement.replaceChild(this.draggedColumnEl, this.placeholderEl);
                    const newColumnOrder = Array.from(this.boardEl.querySelectorAll('.kanban-column')).map(col => col.dataset.columnId);
                    this.boardData.columns.sort((a, b) => newColumnOrder.indexOf(a.id) - newColumnOrder.indexOf(b.id));
                    this.markDirty();
                }
            } 
            else if (this.draggedCardEl) {
                const targetColumnEl = e.target.closest('.kanban-column');
                const cardsContainer = e.target.closest('.cards-container');
                if (cardsContainer) cardsContainer.classList.remove('drag-over');
                
                if (targetColumnEl) {
                    const cardId = this.draggedCardEl.dataset.cardId;
                    const targetColumnId = targetColumnEl.dataset.columnId;
                    const sourceColumn = this.boardData.columns.find(c => c.id === this.sourceColumnId);
                    if (!sourceColumn) return;
                    const cardIndex = sourceColumn.cards.findIndex(c => c.id === cardId);
                    if (cardIndex === -1) return;
                    const [cardToMove] = sourceColumn.cards.splice(cardIndex, 1);
                    const targetColumn = this.boardData.columns.find(c => c.id === targetColumnId);
                    const targetCardEl = e.target.closest('.kanban-card');
                    if (targetCardEl && targetCardEl !== this.draggedCardEl) {
                        const targetCardId = targetCardEl.dataset.cardId;
                        const targetIndex = targetColumn.cards.findIndex(c => c.id === targetCardId);
                        targetColumn.cards.splice(targetIndex, 0, cardToMove);
                    } else {
                        targetColumn.cards.push(cardToMove);
                    }
                    this.markDirty();
                    this.renderBoard();
                }
            }
        },
        
        handleDragEnd: function(e) {
            if (this.draggedColumnEl) {
                this.draggedColumnEl.classList.remove('column-dragging');
                if (this.placeholderEl && this.placeholderEl.parentElement) {
                    this.placeholderEl.parentElement.removeChild(this.placeholderEl);
                }
                this.draggedColumnEl = null;
                this.placeholderEl = null;
                this.renderBoard(); 
            }
            if (this.draggedCardEl) { 
                this.draggedCardEl.classList.remove('dragging');
                this.draggedCardEl = null; 
                this.sourceColumnId = null;
            }
        },

        touchGhostEl: null, touchStartEl: null, touchStartX: 0, touchStartY: 0, 
        isTouchDragging: false, longPressTimer: null,
        handleTouchStart: function(e) {
            // Nota: Arrastar colunas por toque não está implementado. Apenas cards.
            const cardEl = e.target.closest('.kanban-card'); 
            if (!cardEl) return;
            this.longPressTimer = setTimeout(() => {
                this.isTouchDragging = true; 
                this.touchStartEl = cardEl; 
                this.sourceColumnId = cardEl.closest('.kanban-column').dataset.columnId;
                cardEl.classList.add('touch-dragging'); 
                this.touchGhostEl = cardEl.cloneNode(true); 
                this.touchGhostEl.classList.add('touch-ghost');
                document.body.appendChild(this.touchGhostEl); 
                const touch = e.touches[0]; 
                this.touchStartX = touch.clientX; 
                this.touchStartY = touch.clientY;
                this.touchGhostEl.style.width = `${cardEl.offsetWidth}px`; 
                this.moveGhost(touch.clientX, touch.clientY); 
                e.preventDefault();
            }, 200);
        },
        handleTouchMove: function(e) {
            if (!this.isTouchDragging || !this.touchGhostEl) return; 
            e.preventDefault();
            const touch = e.touches[0]; 
            this.moveGhost(touch.clientX, touch.clientY); 
            this.touchGhostEl.style.display = 'none';
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY); 
            this.touchGhostEl.style.display = '';
            this.boardEl.querySelectorAll('.cards-container.drag-over').forEach(el => el.classList.remove('drag-over'));
            const columnContainer = elementBelow ? elementBelow.closest('.cards-container') : null; 
            if (columnContainer) { 
                columnContainer.classList.add('drag-over'); 
            }
        },
        handleTouchEnd: function(e) {
            clearTimeout(this.longPressTimer); 
            if (!this.isTouchDragging || !this.touchGhostEl) {
                this.isTouchDragging = false; 
                return;
            }
            const touch = e.changedTouches[0]; 
            this.touchGhostEl.style.display = 'none';
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetColumnEl = elementBelow ? elementBelow.closest('.kanban-column') : null;
            let cardMoved = false;
            if (targetColumnEl) {
                const cardId = this.touchStartEl.dataset.cardId; 
                const targetColumnId = targetColumnEl.dataset.columnId;
                const sourceColumn = this.boardData.columns.find(c => c.id === this.sourceColumnId);
                const cardIndex = sourceColumn.cards.findIndex(c => c.id === cardId);
                if (cardIndex > -1) {
                    const [cardToMove] = sourceColumn.cards.splice(cardIndex, 1);
                    const targetColumn = this.boardData.columns.find(c => c.id === targetColumnId);
                    const targetCardEl = elementBelow.closest('.kanban-card');
                    if (targetCardEl && targetCardEl !== this.touchStartEl) {
                        const targetCardId = targetCardEl.dataset.cardId;
                        const targetIndex = targetColumn.cards.findIndex(c => c.id === targetCardId);
                        targetColumn.cards.splice(targetIndex, 0, cardToMove);
                    } else { 
                        targetColumn.cards.push(cardToMove); 
                    }
                    cardMoved = true;
                }
            }

            this.touchStartEl.classList.remove('touch-dragging'); 
            if (this.touchGhostEl && this.touchGhostEl.parentElement) {
                this.touchGhostEl.parentElement.removeChild(this.touchGhostEl);
            }
            this.boardEl.querySelectorAll('.cards-container.drag-over').forEach(el => el.classList.remove('drag-over'));
            this.touchGhostEl = null; 
            this.touchStartEl = null; 
            this.sourceColumnId = null;
            setTimeout(() => { this.isTouchDragging = false; }, 100);
            
            if (cardMoved) { 
                this.markDirty(); 
                this.renderBoard(); 
            }
        },
        moveGhost: function(x, y) { 
            if (!this.touchGhostEl) return; 
            this.touchGhostEl.style.left = `${x - this.touchGhostEl.offsetWidth / 2}px`; 
            this.touchGhostEl.style.top = `${y - this.touchGhostEl.offsetHeight / 2}px`; 
        },
        cleanup: function() { 
            if(this.touchGhostEl && this.touchGhostEl.parentElement) {
                this.touchGhostEl.parentElement.removeChild(this.touchGhostEl);
            }
            if (this.placeholderEl && this.placeholderEl.parentElement) {
                this.placeholderEl.parentElement.removeChild(this.placeholderEl);
            }
        }
    };

    initializeFileState(appState, "Novo Kanban Board", "board.kanban", "kanban-board");
    winData.currentAppInstance = appState;
    appState.init();
    return winId;
}
