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
                const data = typeof dataString === 'string' ? JSON.parse(dataString) : dataString;
                if (data && data.format === "node_tree" && data.data && typeof data.data === 'object') {
                    if (winData.jmInstance) {
                        winData.jmInstance.show(data);
                    } else {
                        // jsMind ainda não foi inicializado (setTimeout abaixo); aplica ao iniciar.
                        this.pendingData = data;
                    }
                    this.fileId = fileMeta?.id ?? null;
                    this.markClean();
                    if (fileMeta?.name) window.windowManager.updateWindowTitle(this.winId, fileMeta.name);
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
                // support_html: false evita injeção de HTML/script via tópicos de arquivos importados.
                const options = { container: appState.jsmindContainerId, editable: true, support_html: false, theme: window.themeManager.isDark ? 'dark' : 'primary' };
                winData.jmInstance = new jsMind(options);
                // Os atalhos do jsMind escutam o document inteiro; restringe à janela ativa deste mapa
                // e ignora teclas digitadas em campos de texto (senão Delete/Enter em outro app alteram o mapa).
                // Objeto próprio por instância: o jsMind compartilha o objeto de opções padrão entre instâncias.
                if (winData.jmInstance.shortcut) {
                    winData.jmInstance.shortcut.opts = {
                        get enable() {
                            if (!winData.jmInstance || window.windowManager.activeWindowId !== winId) return false;
                            const ae = document.activeElement;
                            return !(ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)));
                        },
                        set enable(v) {}
                    };
                }
                winData.jmInstance.show(appState.pendingData || mindData);
                appState.pendingData = null;
                // Marca como alterado em qualquer edição (adicionar, remover, renomear, mover nós).
                winData.jmInstance.add_event_listener((type) => {
                    if (type === jsMind.event_type.edit) appState.markDirty();
                });
                
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
            } catch (e) { console.error("Erro ao inicializar Mapa Mental:", e); }
        }
    }, 150);
    return winId;
}

function exportMindMapPNG(jmInstance, containerId) {
     if (!jmInstance || !jmInstance.mind) return;
     if (typeof html2canvas === 'undefined') { showNotification("Biblioteca de exportação indisponível.", 3000); return; }
     const mind = jmInstance.mind;
     const filename = ((mind.root && mind.root.topic) || mind.name || 'mapa_mental') + '.png';
     html2canvas(document.getElementById(containerId)).then(canvas => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL("image/png");
        link.click();
     }).catch(err => { console.error(err); showNotification("Falha ao exportar PNG.", 3000); });
}
function addMindMapNodeInteractive(jm, appState) { if(!jm) return; const n = jm.get_selected_node(); if(!n) return; const t=prompt("Nome:"); if(t) {jm.add_node(n.id, jsMind.util.uuid.newid(),t); appState.markDirty();}}
function removeMindMapNodeInteractive(jm, appState) {if(!jm) return; const n=jm.get_selected_node(); if(n && !n.isroot && confirm("Remover?")){jm.remove_node(n.id);appState.markDirty();}}
function setMindMapNodeColor(jm, bg, fg, appState){if(!jm) return; const n=jm.get_selected_node(); if(n){jm.set_node_color(n.id,bg,fg); appState.markDirty();}}