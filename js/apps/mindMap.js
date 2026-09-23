import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openMindMap() {
    const uniqueSuffix = generateId('mm');
    const winId = window.windowManager.createWindow('Novo Mapa Mental', '', {
        width: '950px',
        height: '650px',
        appType: 'mindmap'
    });
    const content = `
        <div class="mindmap-toolbar app-toolbar" id="mmToolbar_${uniqueSuffix}">
            ${getStandardAppToolbarHTML()}
            <span class="toolbar-separator" style="width:1px; background-color: var(--separator-color); margin:0 4px;"></span>
             <button class="app-button secondary" data-action="export-png" title="Exportar PNG"><i class="fas fa-image"></i> PNG</button>
            <button class="app-button" data-action="add-node" title="Adicionar Nó Filho"><i class="fas fa-plus-circle"></i> Nó</button>
            <button class="app-button" data-action="remove-node" title="Remover Nó"><i class="fas fa-minus-circle"></i> Remover</button>
            <span class="toolbar-separator" style="width:1px; background-color: var(--separator-color); margin:0 4px;"></span>
            <label for="bgColorPicker_${uniqueSuffix}">Fundo:</label>
            <input type="color" id="bgColorPicker_${uniqueSuffix}" value="${window.themeManager.isDark ? '#555555' : '#FFFFFF'}">
            <label for="fgColorPicker_${uniqueSuffix}">Texto:</label>
            <input type="color" id="fgColorPicker_${uniqueSuffix}" value="${window.themeManager.isDark ? '#FFFFFF' : '#000000'}">
        </div>
        <div class="mindmap-container" id="jsmindContainer_${uniqueSuffix}"></div>`;
    const winData = window.windowManager.windows.get(winId);
    if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;
    winData.element.querySelector('.window-content').style.padding = '0';

    const appState = {
        winId,
        appDataType: 'mindmap',
        getData: function() { return winData.jmInstance ? winData.jmInstance.get_data('node_tree') : {}; },
        loadData: function(dataString, fileMeta) {
            try {
                const data = JSON.parse(dataString);
                if (data.format === "node_tree" && data.data) {
                    winData.jmInstance.show(data);
                    this.fileId = fileMeta.id;
                    this.markClean();
                    window.windowManager.updateWindowTitle(this.winId, fileMeta.name);
                } else {
                    showNotification("Formato de arquivo inválido.", 3000);
                }
            } catch (e) {
                 showNotification("Erro: Arquivo de mapa mental inválido.", 3000);
            }
        },
        jsmindContainerId: `jsmindContainer_${uniqueSuffix}`,
        cleanup: () => { winData.jmInstance = null; }
    };
    
    initializeFileState(appState, "Novo Mapa Mental", "novo_mapa.wosmm", "mindmap");
    winData.currentAppInstance = appState;
    setupAppToolbarActions(appState);
    
    setTimeout(() => {
        if (typeof jsMind !== 'undefined') {
            try {
                const mindData = { meta: { name: "WebOS_MindMap", author: "User", version: "1.0" }, format: "node_tree", data: { id: "root", topic: "Tema Central", children: [] } };
                const options = { container: appState.jsmindContainerId, editable: true, theme: window.themeManager.isDark ? 'dark' : 'primary' };
                winData.jmInstance = new jsMind(options);
                winData.jmInstance.show(mindData);
                
                const toolbar = winData.element.querySelector(`#mmToolbar_${uniqueSuffix}`);
                toolbar.addEventListener('click', (e) => {
                     const button = e.target.closest('button[data-action]');
                     if(!button) return;
                     const action = button.dataset.action;
                     const jm = winData.jmInstance;
                     
                     if (action === 'export-png') exportMindMapPNG(jm, appState.jsmindContainerId);
                     else if(action === 'add-node') addMindMapNodeInteractive(jm, appState);
                     else if(action === 'remove-node') removeMindMapNodeInteractive(jm, appState);
                });
                
                toolbar.querySelector(`#bgColorPicker_${uniqueSuffix}`).oninput = (e) => setMindMapNodeColor(winData.jmInstance, e.target.value, null, appState);
                toolbar.querySelector(`#fgColorPicker_${uniqueSuffix}`).oninput = (e) => setMindMapNodeColor(winData.jmInstance, null, e.target.value, appState);
                winData.element.querySelector('.jsmind_editor').addEventListener('input', () => appState.markDirty());
            } catch (e) { console.error("Erro ao inicializar Mapa Mental:", e); }
        }
    }, 150);
    return winId;
}

function exportMindMapPNG(jmInstance, containerId) {
     const mind = jmInstance.mind;
     const filename = (mind.data.topic || mind.meta.name || 'mapa_mental') + '.png';
     html2canvas(document.getElementById(containerId)).then(canvas => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL("image/png");
        link.click();
     });
}
function addMindMapNodeInteractive(jm, appState) { const n = jm.get_selected_node(); if(!n) return; const t=prompt("Nome:"); if(t) {jm.add_node(n.id, jsMind.util.uuid.newid(),t); appState.markDirty();}}
function removeMindMapNodeInteractive(jm, appState) {const n=jm.get_selected_node(); if(n && !n.isroot && confirm("Remover?")){jm.remove_node(n.id);appState.markDirty();}}
function setMindMapNodeColor(jm, bg, fg, appState){const n=jm.get_selected_node(); if(n){jm.set_node_color(n.id,bg,fg); appState.markDirty();}}