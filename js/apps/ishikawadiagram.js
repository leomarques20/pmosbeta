import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openIshikawaDiagram() {
    const uniqueSuffix = generateId('ishikawa');
    const winId = window.windowManager.createWindow('Diagrama de Ishikawa', '', { width: '900px', height: '700px', appType: 'ishikawa-diagram' });
    const content = `
        <div class="app-toolbar ishikawa-controls">
            ${getStandardAppToolbarHTML()}
            <button id="addCategoryIshikawaBtn_${uniqueSuffix}" class="app-button" style="margin-left:auto;"><i class="fas fa-sitemap"></i> Nova Categoria</button>
        </div>
        <div class="ishikawa-main-content" id="ishikawaMainContent_${uniqueSuffix}" style="padding: 15px; overflow: auto; display:block;">
            <div class="app-section" style="margin-bottom: 20px;">
                <h4><i class="fas fa-fish" style="margin-right:8px; opacity:0.7;"></i> Problema / Efeito Central:</h4>
                <input type="text" id="ishikawaProblemInput_${uniqueSuffix}" class="app-input" placeholder="Descreva o problema ou efeito a ser analisado" style="font-size:1.1em; font-weight:bold;">
            </div>
            <div id="ishikawaCategoriesArea_${uniqueSuffix}" style="display: flex; flex-direction: column; gap: 15px;"></div>
        </div>`;
    const winData = window.windowManager.windows.get(winId); if(!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;

    const appState = {
        winId, data: { problem: "", categories: [] }, appDataType: 'ishikawa-diagram',
        problemInput: winData.element.querySelector(`#ishikawaProblemInput_${uniqueSuffix}`), 
        categoriesArea: winData.element.querySelector(`#ishikawaCategoriesArea_${uniqueSuffix}`),
        getData: function() { this.data.problem = this.problemInput.value; return this.data; },
        loadData: function(dataString, fileMeta) { 
            try { 
                const data = JSON.parse(dataString);
                this.data = data || { problem: "", categories: [] }; 
                this.data.categories.forEach(cat => { cat.causes = cat.causes || []; cat.causes.forEach(cause => cause.subCauses = cause.subCauses || []); }); 
                this.fileId = fileMeta.id; 
                this.markClean(); 
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
                this.renderAll();
            } catch (e) { 
                showNotification("Erro ao ler arquivo Ishikawa.", 3000); 
            } 
        },
        init: function() { 
            setupAppToolbarActions(this);
            const addCategoryBtn = winData.element.querySelector(`#addCategoryIshikawaBtn_${uniqueSuffix}`); 
            this.problemInput.oninput = () => this.markDirty(); 
            addCategoryBtn.onclick = () => this.addCategory(); 
            this.categoriesArea.addEventListener('click', (e) => this.handleCategoryAreaClick(e)); 
            this.categoriesArea.addEventListener('input', (e) => this.handleCategoryAreaInput(e)); 
            if (!this.data.categories.length) this.resetToDefaultCategories(); 
            this.renderAll(); 
        },
        resetToDefaultCategories: function() { this.data.problem = ""; this.data.categories = ["Método", "Máquina", "Mão-de-obra", "Material", "Medição", "Meio Ambiente"].map(name => ({ id: generateId('catIsh'), name: name, causes: [] })); },
        renderAll: function() { this.problemInput.value = this.data.problem; this.categoriesArea.innerHTML = ''; this.data.categories.forEach((cat, catIndex) => this.renderCategory(cat, catIndex)); },
        renderCategory: function(categoryData, catIndex) { const catDiv = document.createElement('div'); catDiv.className = 'ishikawa-category-content app-section'; catDiv.dataset.catIndex = catIndex; catDiv.innerHTML = `<h5><input type="text" class="app-input category-name-input" value="${categoryData.name}" placeholder="Nome da Categoria"><span><button class="app-button secondary small-action" data-action="add-cause" title="Adicionar Causa"><i class="fas fa-plus"></i> Causa</button><button class="app-button danger small-action" data-action="delete-category" title="Excluir Categoria"><i class="fas fa-trash"></i></button></span></h5><ul class="causes-list"></ul>`; this.categoriesArea.appendChild(catDiv); const causesListUl = catDiv.querySelector('.causes-list'); categoryData.causes.forEach((cause, causeIndex) => this.renderCause(causesListUl, catIndex, cause, causeIndex)); },
        renderCause: function(causesListUl, catIndex, causeData, causeIndex) { const causeLi = document.createElement('li'); causeLi.className = 'cause-item'; causeLi.dataset.causeIndex = causeIndex; causeLi.innerHTML = `<div style="display:flex; align-items:center; gap:5px;"><input type="text" class="app-input" value="${causeData.text}" placeholder="Causa Principal"><button class="app-button secondary small-action" data-action="add-subcause" title="Adicionar Sub-causa"><i class="fas fa-sitemap"></i></button><button class="app-button danger small-action" data-action="delete-cause" title="Excluir Causa"><i class="fas fa-minus-circle"></i></button></div><ul class="subcauses-list"></ul>`; causesListUl.appendChild(causeLi); const subcausesListUl = causeLi.querySelector('.subcauses-list'); causeData.subCauses.forEach((subCauseText, subCauseIndex) => this.renderSubCause(subcausesListUl, catIndex, causeIndex, subCauseText, subCauseIndex)); },
        renderSubCause: function(subcausesListUl, catIndex, causeIndex, subCauseText, subCauseIndex) { const subCauseLi = document.createElement('li'); subCauseLi.className = 'subcause-item'; subCauseLi.dataset.subcauseIndex = subCauseIndex; subCauseLi.innerHTML = `<div style="display:flex; align-items:center; gap:5px;"><input type="text" class="app-input" value="${subCauseText}" placeholder="Sub-causa"><button class="app-button danger small-action" data-action="delete-subcause" title="Excluir Sub-causa"><i class="fas fa-times"></i></button></div>`; subcausesListUl.appendChild(subCauseLi); },
        addCategory: function() { this.data.categories.push({ id: generateId('catIsh'), name: "Nova Categoria", causes: [] }); this.markDirty(); this.renderAll(); },
        handleCategoryAreaClick: function(e) { const button = e.target.closest('button[data-action]'); if (!button) return; const action = button.dataset.action; const catDiv = button.closest('.ishikawa-category-content'); const catIndex = parseInt(catDiv?.dataset.catIndex); const causeLi = button.closest('.cause-item'); const causeIndex = parseInt(causeLi?.dataset.causeIndex); const subCauseLi = button.closest('.subcause-item'); const subCauseIndex = parseInt(subCauseLi?.dataset.subcauseIndex); if (action === 'delete-category') this.data.categories.splice(catIndex, 1); else if (action === 'add-cause') this.data.categories[catIndex].causes.push({ id: generateId('cauIsh'), text: "", subCauses: [] }); else if (action === 'delete-cause') this.data.categories[catIndex].causes.splice(causeIndex, 1); else if (action === 'add-subcause') this.data.categories[catIndex].causes[causeIndex].subCauses.push(""); else if (action === 'delete-subcause') this.data.categories[catIndex].causes[causeIndex].subCauses.splice(subCauseIndex, 1); this.markDirty(); this.renderAll(); },
        handleCategoryAreaInput: function(e) { const input = e.target.closest('input[type="text"]'); if (!input) return; const catDiv = input.closest('.ishikawa-category-content'); const catIndex = parseInt(catDiv?.dataset.catIndex); const causeLi = input.closest('.cause-item'); const causeIndex = parseInt(causeLi?.dataset.causeIndex); const subCauseLi = input.closest('.subcause-item'); const subCauseIndex = parseInt(subCauseLi?.dataset.subcauseIndex); if (input.classList.contains('category-name-input')) { this.data.categories[catIndex].name = input.value; } else if (causeLi && !subCauseLi) { this.data.categories[catIndex].causes[causeIndex].text = input.value; } else if (subCauseLi) { this.data.categories[catIndex].causes[causeIndex].subCauses[subCauseIndex] = input.value; } this.markDirty(); },
        cleanup: () => {}
    };
    initializeFileState(appState, "Novo Diagrama Ishikawa", "diagrama.ishikawa", "ishikawa-diagram");
    winData.currentAppInstance = appState;
    appState.init();
    return winId;
}