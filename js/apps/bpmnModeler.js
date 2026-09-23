/**
 * BPMN Modeler 2.0 – Estilo Bizagi
 * ------------------------------------------------------------
 * Este módulo substitui o modelador BPMN simples por uma versão
 * gráfica completa baseada na biblioteca bpmn-js, fornecendo
 * experiência similar ao Bizagi Modeler diretamente no PMOS.
 *
 * © 2025 Leonardo Verona – MIT
 */

import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

/**
 * Garante que a biblioteca bpmn-js e seus estilos estejam carregados
 * antes de prosseguir. Evita carregamentos duplicados.
 * @param {Function} callback – Função chamada após a lib estar pronta
 */
function ensureBpmnLibrary(callback) {
    if (window.BpmnJS) { callback(); return; }

    // Se já estiver carregando, apenas empilha o callback
    if (window._bpmnLoadingQueue) {
        window._bpmnLoadingQueue.push(callback);
        return;
    }

    window._bpmnLoadingQueue = [callback];

    // Estilos principais do diagram-js e fontes BPMN
    const cssLinks = [
        'https://unpkg.com/bpmn-js@11.5.0/dist/assets/diagram-js.css',
        'https://unpkg.com/bpmn-js@11.5.0/dist/assets/bpmn-font/css/bpmn-embedded.css'
    ];
    cssLinks.forEach(href => {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        document.head.appendChild(l);
    });

    // Script principal
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/bpmn-js@11.5.0/dist/bpmn-modeler.development.js';
    script.onload = () => {
        window._bpmnLoadingQueue.forEach(cb => cb());
        window._bpmnLoadingQueue = null;
    };
    script.onerror = () => {
        showNotification('Falha ao carregar biblioteca bpmn-js', 4000);
        window._bpmnLoadingQueue = null;
    };
    document.head.appendChild(script);
}

/**
 * Cria uma janela dedicada ao Modelador BPMN
 */
export function openBPMNModeler() {
    const unique = generateId('bpmn');
    const winId = window.windowManager.createWindow(
        'Modelador BPMN 2.0',
        '',
        { width: '1000px', height: '750px', appType: 'bpmn-modeler' }
    );

    const htmlContent = `
        <div class="app-toolbar bpmn-toolbar">
            ${getStandardAppToolbarHTML()}
            <button id="newDiagramBtn_${unique}" class="app-button"><i class="fas fa-file"></i> Novo</button>
            <button id="importXmlBtn_${unique}" class="app-button"><i class="fas fa-file-import"></i> Importar XML</button>
            <button id="exportSvgBtn_${unique}" class="app-button secondary"><i class="fas fa-image"></i> Exportar SVG</button>
            <input type="file" id="importFileInput_${unique}" accept=".bpmn,.xml" style="display:none;">
        </div>
        <div id="bpmnCanvas_${unique}" class="bpmn-diagram-container" style="flex:1; min-height:400px; background:#fff;"></div>
    `;

    const winData = window.windowManager.windows.get(winId);
    if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = htmlContent;

    /* ---------- Estado do aplicativo ---------- */
    const appState = {
        winId,
        appDataType: 'bpmn-modeler',
        modeler: null,
        currentXML: '',
        fileId: null,
        isDirty: false,

        /* Retorna dados para persistência */
        getData() {
            return { xml: this.currentXML || '' };
        },

        /* Carrega dados de arquivo salvo */
        async loadData(dataString, fileMeta) {
            try {
                const data = JSON.parse(dataString);
                await this.importXML(data.xml || '');
                this.fileId = fileMeta.id;
                this.markClean();
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name);
            } catch (err) {
                console.error(err);
                showNotification('Erro ao carregar XML', 3000);
            }
        },

        /* Marca o estado como “sujo” para indicar alterações não salvas */
        markDirty() {
            if (!this.isDirty) {
                this.isDirty = true;
                const win = window.windowManager.windows.get(this.winId);
                if (win && !win.title.startsWith('*')) {
                    window.windowManager.updateWindowTitle(this.winId, '*' + win.title);
                }
            }
        },

        /* Marca como limpo (salvo) */
        markClean() {
            this.isDirty = false;
            const win = window.windowManager.windows.get(this.winId);
            if (win && win.title.startsWith('*')) {
                window.windowManager.updateWindowTitle(this.winId, win.title.slice(1));
            }
        },

        /* ---------- Fluxo de interface ---------- */
        init() {
            const newBtn  = winData.element.querySelector(`#newDiagramBtn_${unique}`);
            const impBtn  = winData.element.querySelector(`#importXmlBtn_${unique}`);
            const expBtn  = winData.element.querySelector(`#exportSvgBtn_${unique}`);
            const input   = winData.element.querySelector(`#importFileInput_${unique}`);

            newBtn.onclick = () => this.createNewDiagram();
            impBtn.onclick = () => input.click();
            expBtn.onclick = () => this.exportSVG();
            input.onchange = (e) => {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (evt) => this.importXML(evt.target.result);
                    reader.readAsText(e.target.files[0]);
                    input.value = '';
                }
            };

            setupAppToolbarActions(this);

            // Carrega biblioteca e instancia modeler
            ensureBpmnLibrary(() => {
                this.modeler = new BpmnJS({
                    container: `#bpmnCanvas_${unique}`,
                    keyboard: { bindTo: winData.element }
                });

                // Observa alterações para auto-atualizar XML
                this.modeler.on('commandStack.changed', async () => {
                    const { xml } = await this.modeler.saveXML({ format: true });
                    this.currentXML = xml;
                    this.markDirty();
                });

                // Cria diagrama inicial
                this.createNewDiagram();
            });
        },

        async createNewDiagram() {
            if (!this.modeler) return;
            try {
                await this.modeler.createDiagram();
                const { xml } = await this.modeler.saveXML({ format: true });
                this.currentXML = xml;
                this.markDirty();
            } catch (err) {
                console.error(err);
                showNotification('Erro ao criar diagrama', 3000);
            }
        },

        async importXML(xml) {
            if (!this.modeler) return;
            try {
                await this.modeler.importXML(xml || '');
                this.currentXML = xml;
                this.markDirty();
            } catch (err) {
                console.error(err);
                showNotification('Falha ao importar XML', 3000);
            }
        },

        async exportSVG() {
            if (!this.modeler) return;
            try {
                const { svg } = await this.modeler.saveSVG({ format: true });
                const blob = new Blob([svg], { type: 'image/svg+xml' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url;
                a.download = 'diagrama_bpmn.svg';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (err) {
                console.error(err);
                showNotification('Falha ao exportar SVG', 3000);
            }
        },

        /* Limpeza ao fechar */
        cleanup() {
            if (this.modeler) {
                this.modeler.destroy();
                this.modeler = null;
            }
        }
    };

    /* Configura estado e toolbar padrão */
    initializeFileState(appState, 'Novo Modelo BPMN', 'modelo.bpmn', 'bpmn-modeler');
    winData.currentAppInstance = appState;
    appState.init();

    return winId;
}
