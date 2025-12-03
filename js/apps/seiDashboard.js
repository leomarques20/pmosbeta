import { generateId, showNotification } from '../main.js';
import { openKanbanBoard } from './kanbanBoard.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

// URL relativa para funcionar tanto local quanto no Netlify
const API_BASE = '/api/sei';

async function fetchCaptcha() {
    const res = await fetch(`/.netlify/functions/sei-auth-challenge`);
    if (!res.ok) throw new Error("Falha ao carregar Captcha");
    return await res.json();
}

async function fetchProcessos(usuario, senha, orgao, captcha) {
    const res = await fetch(`/.netlify/functions/sei-login-puppeteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            usuario, senha, orgao, captcha
        })
    });

    if (!res.ok) {
        let errorMessage = "Erro ao buscar processos";
        try {
            const err = await res.json();
            errorMessage = err.error || err.detail || err.message || errorMessage;
        } catch (parseError) {
            console.warn("Não foi possível ler o erro da API SEI:", parseError);
        }
        const httpError = new Error(errorMessage);
        httpError.status = res.status;
        throw httpError;
    }
    return await res.json();
}

export function openSeiDashboard() {
    const uniqueSuffix = generateId('sei');
    const winId = window.windowManager.createWindow('Dashboard SEI', '', { width: '900px', height: '650px', appType: 'sei-dashboard' });

    const content = `
        <div class="app-toolbar" style="display: flex; gap: 10px; padding: 10px; background: var(--toolbar-bg); border-bottom: 1px solid var(--separator-color); align-items: center;">
             ${getStandardAppToolbarHTML()}
             <div style="flex-grow: 1; display: flex; gap: 10px; align-items: center;">
                <div class="search-box" style="position: relative; flex-grow: 1; max-width: 300px;">
                    <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--secondary-text-color);"></i>
                    <input type="text" id="searchInput_${uniqueSuffix}" class="app-input" placeholder="Buscar processos..." style="margin-bottom:0; width: 100%; padding-left: 35px;">
                </div>
                <select id="priorityFilter_${uniqueSuffix}" class="app-select" style="margin-bottom: 0; width: auto;">
                    <option value="all">Todas Prioridades</option>
                    <option value="high">Alta Prioridade</option>
                    <option value="medium">Média Prioridade</option>
                    <option value="low">Baixa Prioridade</option>
                </select>
             </div>
        </div>
        <div class="sei-dashboard-container" style="padding: 20px; display: flex; flex-direction: column; height: calc(100% - 60px); overflow: hidden;">
            
            <div class="sei-login-panel" style="background: var(--window-bg); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--separator-color);">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="text" id="seiUser_${uniqueSuffix}" placeholder="Usuário SEI" class="app-input" style="flex: 1;">
                    <input type="password" id="seiPass_${uniqueSuffix}" placeholder="Senha SEI" class="app-input" style="flex: 1;">
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <select id="seiOrgao_${uniqueSuffix}" class="app-input" style="flex: 1;">
                        <option value="0" selected>GOVMG</option>
                        <option value="7">AGE</option>
                        <option value="55">ARMBH</option>
                        <option value="57">ARMVA</option>
                        <option value="56">ARSAE-MG</option>
                        <option value="99">ARTEMIG</option>
                        <option value="91">BDMG</option>
                        <option value="21">CBMMG</option>
                        <option value="18">CEE</option>
                        <option value="30">CGE</option>
                        <option value="86">CODEMGE</option>
                        <option value="95">CODEMIG</option>
                        <option value="71">COHAB</option>
                        <option value="94">CONSET</option>
                        <option value="92">CTL</option>
                        <option value="64">DER</option>
                        <option value="83">DETEL</option>
                        <option value="23">DPMG</option>
                        <option value="68">EMATER</option>
                        <option value="87">EMC</option>
                        <option value="66">EPAMIG</option>
                        <option value="19">ESP</option>
                        <option value="48">FAOP</option>
                        <option value="44">FAPEMIG</option>
                        <option value="47">FCS</option>
                        <option value="54">FEAM</option>
                        <option value="45">FHA</option>
                        <option value="52">FHEMIG</option>
                        <option value="53">FJP</option>
                        <option value="46">FUCAM</option>
                        <option value="51">FUNED</option>
                        <option value="6">GMG</option>
                        <option value="50">HEMOMINAS</option>
                        <option value="42">IDENE</option>
                        <option value="61">IEF</option>
                        <option value="49">IEPHA</option>
                        <option value="62">IGAM</option>
                        <option value="40">IMA</option>
                        <option value="33">INVESTMINAS</option>
                        <option value="41">IPEM</option>
                        <option value="63">IPSEMG</option>
                        <option value="58">IPSM</option>
                        <option value="81">JUCEMG</option>
                        <option value="43">LEMG</option>
                        <option value="84">MGI</option>
                        <option value="98">MGS</option>
                        <option value="9">OGE</option>
                        <option value="29">PCMG</option>
                        <option value="13">PMMG</option>
                        <option value="74">PRODEMGE</option>
                        <option value="31">SCC</option>
                        <option value="12">SEAPA</option>
                        <option value="15">SEC</option>
                        <option value="39">SECGERAL</option>
                        <option value="25">SECIR</option>
                        <option value="97">SECOM</option>
                        <option value="22">SECULT</option>
                        <option value="34">SEDA</option>
                        <option value="11">SEDE</option>
                        <option value="26">SEDESE</option>
                        <option value="32">SEDINOR</option>
                        <option value="35">SEDPAC</option>
                        <option value="14">SEE</option>
                        <option value="38">SEEDIF</option>
                        <option value="36">SEESP</option>
                        <option value="10">SEF</option>
                        <option value="27">SEGOV</option>
                        <option value="16">SEINFRA</option>
                        <option value="24">SEJUSP</option>
                        <option value="20">SEMAD</option>
                        <option value="28">SEPLAG</option>
                        <option value="17">SES</option>
                        <option value="37">SESP</option>
                        <option value="82">TVMINAS</option>
                        <option value="59">UEMG</option>
                        <option value="60">UNIMONTES</option>
                        <option value="65">UTRAMIG</option>
                        <option value="89">VICEGOV</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                    <div style="background: white; padding: 5px; border-radius: 4px; border: 1px solid #ccc; height: 40px; display: flex; align-items: center; justify-content: center; min-width: 120px;">
                        <img id="seiCaptchaImg_${uniqueSuffix}" src="" alt="Captcha" style="max-height: 100%; display: none;">
                        <span id="seiCaptchaPlaceholder_${uniqueSuffix}" style="font-size: 0.8em; color: #666;">Carregando...</span>
                    </div>
                    <button id="seiRefreshCaptcha_${uniqueSuffix}" class="app-button secondary" title="Recarregar Captcha"><i class="fas fa-sync"></i></button>
                    <input type="text" id="seiCaptchaInput_${uniqueSuffix}" placeholder="Digite o Captcha" class="app-input" style="width: 120px;">
                </div>

                <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; gap: 5px; font-size: 0.9em; cursor: pointer;">
                        <input type="checkbox" id="seiFilter_${uniqueSuffix}"> Filtrar Meus
                    </label>
                    <button id="seiSyncBtn_${uniqueSuffix}" class="app-button primary">
                        <i class="fas fa-sign-in-alt"></i> Acessar SEI
                    </button>
                </div>
            </div>
            
            <div class="sei-results-area" style="flex: 1; overflow-y: auto; background: var(--input-bg); border-radius: 8px; border: 1px solid var(--separator-color); padding: 10px;">
                <div id="seiLoading_${uniqueSuffix}" style="display: none; text-align: center; padding: 20px; color: var(--secondary-text-color);">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top: 10px;">Acessando SEI...</p>
                </div>
                <div id="seiEmptyState_${uniqueSuffix}" style="text-align: center; padding: 40px; color: var(--secondary-text-color);">
                    <i class="fas fa-folder-open fa-3x" style="opacity: 0.5; margin-bottom: 15px;"></i>
                    <p>Nenhum processo carregado.</p>
                </div>
                <div id="seiList_${uniqueSuffix}" class="sei-process-list" style="display: none;"></div>
            </div>
        </div>`;

    const winData = window.windowManager.windows.get(winId); if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;

    // Elements
    const els = {
        user: winData.element.querySelector(`#seiUser_${uniqueSuffix}`),
        pass: winData.element.querySelector(`#seiPass_${uniqueSuffix}`),
        orgao: winData.element.querySelector(`#seiOrgao_${uniqueSuffix}`),
        captchaInput: winData.element.querySelector(`#seiCaptchaInput_${uniqueSuffix}`),
        captchaImg: winData.element.querySelector(`#seiCaptchaImg_${uniqueSuffix}`),
        captchaPlaceholder: winData.element.querySelector(`#seiCaptchaPlaceholder_${uniqueSuffix}`),
        refreshBtn: winData.element.querySelector(`#seiRefreshCaptcha_${uniqueSuffix}`),
        filter: winData.element.querySelector(`#seiFilter_${uniqueSuffix}`),
        syncBtn: winData.element.querySelector(`#seiSyncBtn_${uniqueSuffix}`),
        loading: winData.element.querySelector(`#seiLoading_${uniqueSuffix}`),
        empty: winData.element.querySelector(`#seiEmptyState_${uniqueSuffix}`),
        list: winData.element.querySelector(`#seiList_${uniqueSuffix}`)
    };

    let currentCookies = {};
    let currentHiddenFields = {};
    let currentLoginUrl = '';

    // Load saved user
    const savedUser = localStorage.getItem('pmos_sei_user');
    if (savedUser) els.user.value = savedUser;

    // Function to load captcha
    const loadCaptcha = async () => {
        els.captchaImg.style.display = 'none';
        els.captchaPlaceholder.style.display = 'block';
        els.captchaPlaceholder.textContent = 'Carregando...';
        els.captchaInput.value = '';

        try {
            const data = await fetchCaptcha();
            if (data.captcha_image) {
                els.captchaImg.src = `data:image/png;base64,${data.captcha_image}`;
                els.captchaImg.style.display = 'block';
                els.captchaPlaceholder.style.display = 'none';
                currentCookies = data.cookies;
                currentHiddenFields = data.hidden_fields;
                currentLoginUrl = data.login_url;
            } else {
                els.captchaPlaceholder.textContent = 'Sem Captcha';
            }
        } catch (e) {
            console.warn("Captcha não carregado (pode ser opcional ou erro 404):", e);
            els.captchaPlaceholder.textContent = 'Sem Captcha';
            // Se falhar, assumimos que não tem captcha ou a API tá fora, 
            // mas permitimos tentar logar se for só o captcha que falhou.
        }
    };

    // Initial load
    loadCaptcha();

    els.refreshBtn.onclick = loadCaptcha;

    // Helper to render process card
    function renderProcessCard(proc, container, isMonitored = false, appState = null) {
        const card = document.createElement('div');
        card.className = 'sei-process-card';

        // Priority Styling
        let priorityColor = 'transparent';
        let priorityBorder = 'var(--separator-color)';
        if (proc.priority === 'high') { priorityBorder = '#dc3545'; priorityColor = 'rgba(220, 53, 69, 0.1)'; }
        else if (proc.priority === 'medium') { priorityBorder = '#ffc107'; priorityColor = 'rgba(255, 193, 7, 0.1)'; }

        card.style.cssText = `background: var(--window-bg); border: 1px solid ${priorityBorder}; border-left: 4px solid ${priorityBorder}; border-radius: 6px; padding: 12px; margin-bottom: 10px; position: relative;`;

        const monitorBtnIcon = isMonitored ? 'fa-trash' : 'fa-eye';
        const monitorBtnText = isMonitored ? 'Remover' : 'Monitorar';

        // Timeline Badge
        let timelineBadge = '';
        if (proc.daysElapsed !== null) {
            let badgeColor = '#28a745'; // Green (recent)
            if (proc.daysElapsed > 30) badgeColor = '#ffc107'; // Yellow (warning)
            if (proc.daysElapsed > 60) badgeColor = '#dc3545'; // Red (old)
            timelineBadge = `<span style="font-size: 0.75em; background: ${badgeColor}; color: #fff; padding: 2px 6px; border-radius: 10px; margin-left: 8px;" title="Dias desde a última movimentação"><i class="far fa-clock"></i> ${proc.daysElapsed}d</span>`;
        }

        // Notes Section
        const note = appState ? appState.getNote(proc.protocolo) : '';
        const noteSection = `
            <div style="margin-top: 10px; padding: 8px; background: var(--input-bg); border-radius: 4px; display: ${note ? 'block' : 'none'};" id="noteDisplay_${proc.protocolo.replace(/\D/g, '')}">
                <i class="fas fa-sticky-note" style="color: var(--accent-color); margin-right: 5px;"></i> <span style="font-size: 0.9em; font-style: italic;">${note}</span>
            </div>
            <div style="margin-top: 10px; display: none;" id="noteEdit_${proc.protocolo.replace(/\D/g, '')}">
                <textarea class="app-textarea" rows="2" placeholder="Adicionar nota pessoal..." style="font-size: 0.9em;">${note}</textarea>
                <button class="app-btn-small" style="margin-top: 5px;">Salvar Nota</button>
            </div>
        `;

        // Deadline Alert
        let deadlineAlert = '';
        if (proc.deadline) {
            const color = proc.deadline.isOverdue ? '#dc3545' : (proc.deadline.isUrgent ? '#ffc107' : '#17a2b8');
            const icon = proc.deadline.isOverdue ? 'fa-exclamation-circle' : 'fa-hourglass-half';
            deadlineAlert = `<span style="font-size: 0.75em; background: ${color}; color: #fff; padding: 2px 6px; border-radius: 10px; margin-left: 8px;" title="Prazo detectado: ${proc.deadline.date}"><i class="fas ${icon}"></i> ${proc.deadline.date}</span>`;
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex-grow: 1; display: flex; gap: 10px;">
                    <div style="padding-top: 4px;">
                        <input type="checkbox" class="process-checkbox" id="cb_${proc.protocolo.replace(/\D/g, '')}" style="transform: scale(1.2); cursor: pointer;">
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                            <a href="${proc.link_sei}" target="_blank" style="font-weight: bold; color: var(--accent-color); text-decoration: none; font-size: 1.1em;">${proc.protocolo}</a>
                            ${timelineBadge}
                            ${deadlineAlert}
                            ${proc.priority === 'high' ? '<span style="font-size: 0.7em; background: #dc3545; color: white; padding: 1px 4px; border-radius: 3px;">URGENTE</span>' : ''}
                            <span style="font-size: 0.7em; background: var(--secondary-bg); color: var(--text-color); padding: 1px 6px; border-radius: 10px; border: 1px solid var(--separator-color);">${proc.category || 'Geral'}</span>
                        </div>
                        <div style="font-size: 0.9em; color: var(--text-color); margin-top: 6px; font-weight: 500; line-height: 1.4;">
                            ${proc.tipo ? `<span style="color: var(--secondary-text-color); font-weight: normal; font-size: 0.9em;">${proc.tipo}</span><br>` : ''}
                            <span title="Resumo Inteligente: ${proc.smartSummary}">
                                <i class="fas fa-magic" style="font-size: 0.8em; color: var(--accent-color); margin-right: 4px;" title="Resumo gerado por IA"></i>
                                ${proc.smartSummary}
                            </span>
                            <div style="font-size: 0.85em; color: var(--secondary-text-color); margin-top: 4px; display: none;" class="full-description">
                                ${proc.descricao || 'Sem descrição detalhada'}
                            </div>
                        </div>
                    </div>
                </div>
                <div style="text-align: right; min-width: 100px;">
                    <span style="font-size: 0.8em; background: var(--button-bg); padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${proc.unidade}</span>
                    ${proc.data ? `<div style="font-size: 0.8em; color: var(--secondary-text-color); margin-top: 4px;">${proc.data}</div>` : ''}
                </div>
            </div>
            
            ${proc.interessados ? `<div style="font-size: 0.85em; color: var(--secondary-text-color); margin-top: 8px; margin-left: 25px;"><strong>Interessados:</strong> ${proc.interessados}</div>` : ''}
            ${proc.atribuido_a ? `<div style="font-size: 0.85em; color: var(--secondary-text-color); margin-top: 2px; margin-left: 25px;"><strong>Atribuído a:</strong> ${proc.atribuido_a}</div>` : ''}

            ${noteSection}

            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--separator-color); display: flex; gap: 8px; margin-left: 25px;">
                <button class="app-btn-small" id="btnQuickView_${proc.protocolo.replace(/\D/g, '')}" style="font-size: 0.8em; padding: 4px 8px; background: var(--accent-color); color: white;">
                    <i class="fas fa-eye"></i> Espiar
                </button>
                <button class="app-btn-small" id="btnImport_${proc.protocolo.replace(/\D/g, '')}" style="font-size: 0.8em; padding: 4px 8px;">
                    <i class="fas fa-download"></i> Importar
                </button>
                <button class="app-btn-small" id="btnMonitor_${proc.protocolo.replace(/\D/g, '')}" style="font-size: 0.8em; padding: 4px 8px;">
                    <i class="fas ${monitorBtnIcon}"></i> ${monitorBtnText}
                </button>
                <button class="app-btn-small" id="btnNote_${proc.protocolo.replace(/\D/g, '')}" style="font-size: 0.8em; padding: 4px 8px;">
                    <i class="fas fa-sticky-note"></i> Nota
                </button>
                <button class="app-btn-small" onclick="window.open('${proc.link_sei}', '_blank')" style="font-size: 0.8em; padding: 4px 8px;">
                    <i class="fas fa-external-link-alt"></i> Abrir
                </button>
            </div>
        `;
        container.appendChild(card);

        // Checkbox Logic
        const checkbox = card.querySelector(`#cb_${proc.protocolo.replace(/\D/g, '')}`);
        if (checkbox && appState) {
            checkbox.checked = appState.selectedProcesses.has(proc.protocolo);
            checkbox.onchange = () => appState.toggleSelection(proc.protocolo);
        }

        // Quick View Logic
        const btnQuickView = card.querySelector(`#btnQuickView_${proc.protocolo.replace(/\D/g, '')}`);
        if (btnQuickView && appState) {
            btnQuickView.onclick = () => appState.openQuickView(proc);
        }

        // Event Listeners
        const btnImport = card.querySelector(`#btnImport_${proc.protocolo.replace(/\D/g, '')}`);
        if (btnImport) {
            btnImport.onclick = () => {
                openKanbanBoard({
                    importData: {
                        title: `Processo SEI ${proc.protocolo}`,
                        description: `Protocolo: ${proc.protocolo}\nUnidade: ${proc.unidade}\nLink: ${proc.link_sei}\n\n${proc.descricao || ''}\n\nInteressados: ${proc.interessados || 'N/A'}`
                    }
                });
            };
        }

        const btnMonitor = card.querySelector(`#btnMonitor_${proc.protocolo.replace(/\D/g, '')}`);
        if (btnMonitor) {
            btnMonitor.onclick = () => {
                const monitored = JSON.parse(localStorage.getItem('pmos_sei_monitored') || '[]');
                if (isMonitored) {
                    const newMonitored = monitored.filter(p => p.protocolo !== proc.protocolo);
                    localStorage.setItem('pmos_sei_monitored', JSON.stringify(newMonitored));
                    showNotification(`Processo ${proc.protocolo} removido dos monitorados.`, 3000);
                    card.remove(); // Remove from view immediately
                } else {
                    if (!monitored.some(p => p.protocolo === proc.protocolo)) {
                        monitored.push(proc);
                        localStorage.setItem('pmos_sei_monitored', JSON.stringify(monitored));
                        showNotification(`Processo ${proc.protocolo} adicionado aos monitorados!`, 3000);
                    } else {
                        showNotification(`Processo ${proc.protocolo} já está sendo monitorado.`, 3000);
                    }
                }
            };
        }

        // Note Logic
        const btnNote = card.querySelector(`#btnNote_${proc.protocolo.replace(/\D/g, '')}`);
        const noteDisplay = card.querySelector(`#noteDisplay_${proc.protocolo.replace(/\D/g, '')}`);
        const noteEdit = card.querySelector(`#noteEdit_${proc.protocolo.replace(/\D/g, '')}`);
        const noteSaveBtn = noteEdit.querySelector('button');
        const noteTextarea = noteEdit.querySelector('textarea');

        if (btnNote) {
            btnNote.onclick = () => {
                if (noteEdit.style.display === 'none') {
                    noteEdit.style.display = 'block';
                    noteDisplay.style.display = 'none';
                    noteTextarea.focus();
                } else {
                    noteEdit.style.display = 'none';
                    if (noteTextarea.value.trim()) noteDisplay.style.display = 'block';
                }
            };
        }

        if (noteSaveBtn && appState) {
            noteSaveBtn.onclick = () => {
                const newNote = noteTextarea.value.trim();
                appState.saveNote(proc.protocolo, newNote);
                noteEdit.style.display = 'none';
                if (newNote) {
                    noteDisplay.style.display = 'block';
                    noteDisplay.querySelector('span').textContent = newNote;
                } else {
                    noteDisplay.style.display = 'none';
                }
            };
        }
    }

    // Add Monitorados Button Action
    const showMonitoredBtn = document.createElement('button');
    showMonitoredBtn.className = 'app-button secondary';
    showMonitoredBtn.innerHTML = '<i class="fas fa-list"></i> Monitorados';
    showMonitoredBtn.style.marginLeft = '10px';
    showMonitoredBtn.onclick = () => {
        els.list.innerHTML = '';
        els.empty.style.display = 'none';
        const monitored = JSON.parse(localStorage.getItem('pmos_sei_monitored') || '[]');
        if (monitored.length > 0) {
            monitored.forEach(proc => renderProcessCard(proc, els.list, true));
            els.list.style.display = 'block';
        } else {
            els.empty.style.display = 'block';
            els.empty.innerHTML = '<p>Nenhum processo monitorado.</p>';
        }
    };

    // Insert button in toolbar (hacky way since we don't have direct ref to toolbar container here easily, 
    // but we can append to the header or replace the sync button container)
    // Actually, let's just append it to the form container for now or find a better place.
    // The toolbar is created in `content` string. Let's find a place to inject it.
    // We can append it to `els.syncBtn.parentNode` if it exists, or just after `els.syncBtn`.
    els.syncBtn.parentNode.insertBefore(showMonitoredBtn, els.syncBtn.nextSibling);

    // Batch Actions Toolbar
    const batchToolbar = document.createElement('div');
    batchToolbar.id = `batchToolbar_${uniqueSuffix}`;
    batchToolbar.style.cssText = 'display: none; position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--toolbar-bg); padding: 10px 20px; border-radius: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 1000; align-items: center; gap: 15px; border: 1px solid var(--accent-color);';
    batchToolbar.innerHTML = `
        <span style="font-weight: bold; color: var(--text-color);"><span id="batchCount_${uniqueSuffix}">0</span> selecionados</span>
        <button class="app-btn-small" id="batchExport_${uniqueSuffix}"><i class="fas fa-file-pdf"></i> Exportar Relatório</button>
        <button class="app-btn-small" style="background: transparent; border: 1px solid var(--text-color); color: var(--text-color);" id="batchClear_${uniqueSuffix}">Cancelar</button>
    `;
    winData.element.querySelector('.sei-dashboard-container').appendChild(batchToolbar);

    const appState = {
        winId,
        appDataType: 'sei-dashboard',
        allProcesses: [],
        filteredProcesses: [],
        selectedProcesses: new Set(),
        filters: {
            search: '',
            priority: 'all', // all, high, medium, low
            unidade: 'all'
        },
        notes: JSON.parse(localStorage.getItem('pmos_sei_notes') || '{}'),

        getData: function () { return {}; },
        loadData: function () { },

        init: function () {
            setupAppToolbarActions(this);

            // Setup Search and Filter Listeners
            const searchInput = winData.element.querySelector(`#searchInput_${uniqueSuffix}`);
            const priorityFilter = winData.element.querySelector(`#priorityFilter_${uniqueSuffix}`);

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filters.search = e.target.value.toLowerCase();
                    this.applyFilters();
                });
            }

            if (priorityFilter) {
                priorityFilter.addEventListener('change', (e) => {
                    this.filters.priority = e.target.value;
                    this.applyFilters();
                });
            }

            // Batch Actions Listeners
            const batchExportBtn = batchToolbar.querySelector(`#batchExport_${uniqueSuffix}`);
            const batchClearBtn = batchToolbar.querySelector(`#batchClear_${uniqueSuffix}`);

            batchExportBtn.onclick = () => this.exportBatchPDF();
            batchClearBtn.onclick = () => this.clearSelection();

            // Initial Load
            this.fetchProcessos();
        },

        toggleSelection: function (protocolo) {
            if (this.selectedProcesses.has(protocolo)) {
                this.selectedProcesses.delete(protocolo);
            } else {
                this.selectedProcesses.add(protocolo);
            }
            this.updateBatchToolbar();
        },

        clearSelection: function () {
            this.selectedProcesses.clear();
            this.updateBatchToolbar();
            // Uncheck all boxes
            const checkboxes = winData.element.querySelectorAll('.process-checkbox');
            checkboxes.forEach(cb => cb.checked = false);
        },

        updateBatchToolbar: function () {
            const count = this.selectedProcesses.size;
            const countSpan = batchToolbar.querySelector(`#batchCount_${uniqueSuffix}`);
            countSpan.textContent = count;
            batchToolbar.style.display = count > 0 ? 'flex' : 'none';
        },

        exportBatchPDF: function () {
            const selected = this.allProcesses.filter(p => this.selectedProcesses.has(p.protocolo));
            if (selected.length === 0) return;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Relatório de Processos SEI</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { text-align: center; color: #333; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .urgent { color: red; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>Relatório de Processos Selecionados</h1>
                    <p>Gerado em: ${new Date().toLocaleString()}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Protocolo</th>
                                <th>Tipo/Resumo</th>
                                <th>Descrição</th>
                                <th>Unidade</th>
                                <th>Prioridade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selected.map(p => `
                                <tr>
                                    <td>${p.protocolo}</td>
                                    <td>${p.tipo || '-'}</td>
                                    <td>${p.descricao || '-'}</td>
                                    <td>${p.unidade}</td>
                                    <td class="${p.priority === 'high' ? 'urgent' : ''}">${p.priority.toUpperCase()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <script>window.print();</script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },

        openQuickView: async function (proc) {
            // Create Modal
            const modalId = `quickViewModal_${uniqueSuffix}`;
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; justify-content: center; align-items: center;';
                modal.innerHTML = `
                    <div style="background: var(--window-bg); width: 80%; height: 80%; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
                        <div style="padding: 15px; border-bottom: 1px solid var(--separator-color); display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0;">Detalhes: <span id="qvTitle_${uniqueSuffix}"></span></h3>
                            <button class="app-btn-close" id="qvClose_${uniqueSuffix}">&times;</button>
                        </div>
                        <div style="flex-grow: 1; display: flex; overflow: hidden;">
                            <div style="width: 30%; border-right: 1px solid var(--separator-color); overflow-y: auto; padding: 10px;" id="qvTree_${uniqueSuffix}">
                                Carregando árvore...
                            </div>
                            <div style="width: 70%; overflow-y: auto; padding: 10px;" id="qvContent_${uniqueSuffix}">
                                <h4 style="margin-top: 0;">Histórico de Andamentos</h4>
                                <div id="qvHistory_${uniqueSuffix}">Carregando histórico...</div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                modal.querySelector(`#qvClose_${uniqueSuffix}`).onclick = () => {
                    modal.style.display = 'none';
                };
            }

            modal.style.display = 'flex';
            modal.querySelector(`#qvTitle_${uniqueSuffix}`).textContent = proc.protocolo;
            modal.querySelector(`#qvTree_${uniqueSuffix}`).innerHTML = '<div class="spinner"></div> Carregando...';
            modal.querySelector(`#qvHistory_${uniqueSuffix}`).innerHTML = '<div class="spinner"></div> Carregando...';

            try {
                const user = localStorage.getItem('pmos_sei_user');
                // We need password too, but storing it in localstorage is unsafe. 
                // Ideally we should use the session cookie, but for now let's ask user to ensure they are logged in or use the inputs if available.
                // Assuming inputs are still populated or we have a token.
                // For this demo, let's use the inputs from the form if visible, or fail gracefully.
                const pass = els.pass.value.trim();
                const orgao = els.orgao.value.trim();

                const response = await fetch('/api/sei/detalhes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usuario: user,
                        senha: pass,
                        orgao: orgao,
                        link_sei: proc.link_sei,
                        cookies: currentCookies
                    })
                });

                const data = await response.json();

                if (data.error) throw new Error(data.error);

                // Render Tree
                const treeHtml = data.tree.map(item => `
                    <div style="padding: 4px 0; padding-left: ${item.type === 'folder' ? '0' : '20px'};">
                        <i class="fas ${item.type === 'folder' ? 'fa-folder' : 'fa-file-alt'}" style="color: ${item.type === 'folder' ? '#f0ad4e' : 'var(--text-color)'}; margin-right: 5px;"></i>
                        <a href="${item.link}" target="_blank" style="text-decoration: none; color: var(--text-color);">${item.title}</a>
                    </div>
                `).join('');
                modal.querySelector(`#qvTree_${uniqueSuffix}`).innerHTML = treeHtml || 'Nenhum documento encontrado.';

                // Render History
                const historyHtml = `
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                        <thead>
                            <tr style="background: var(--secondary-bg); text-align: left;">
                                <th style="padding: 8px;">Data</th>
                                <th style="padding: 8px;">Unidade</th>
                                <th style="padding: 8px;">Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.history.map(h => `
                                <tr style="border-bottom: 1px solid var(--separator-color);">
                                    <td style="padding: 8px;">${h.data}</td>
                                    <td style="padding: 8px;">${h.unidade}</td>
                                    <td style="padding: 8px;">${h.descricao}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                modal.querySelector(`#qvHistory_${uniqueSuffix}`).innerHTML = historyHtml || 'Nenhum andamento encontrado.';

            } catch (e) {
                modal.querySelector(`#qvTree_${uniqueSuffix}`).innerHTML = `<p style="color: red;">Erro: ${e.message}</p>`;
                modal.querySelector(`#qvHistory_${uniqueSuffix}`).innerHTML = '';
            }
        },

        fetchProcessos: async function () {
            const user = els.user.value.trim();
            const pass = els.pass.value.trim();
            const orgao = els.orgao.value.trim();
            const captcha = els.captchaInput.value.trim();

            if (!user || !pass || !orgao) {
                showNotification("Preencha usuário, senha e órgão.", 3000);
                return;
            }

            localStorage.setItem('pmos_sei_user', user);

            els.loading.style.display = 'flex';
            els.list.style.display = 'none';
            els.empty.style.display = 'none';
            els.syncBtn.disabled = true;

            try {
                const data = await fetchProcessos(user, pass, orgao, captcha, currentCookies, currentHiddenFields, currentLoginUrl);

                if (data.error) {
                    if (data.captcha) {
                        loadCaptcha(data.captcha);
                        return;
                    }
                    throw new Error(data.error);
                }

                // Enrich data with local notes and calculated priority
                this.allProcesses = (data.processos || []).map(p => ({
                    ...p,
                    priority: this.calculatePriority(p),
                    daysElapsed: this.calculateDaysElapsed(p.data),
                    category: this.classifyCategory(p),
                    smartSummary: this.generateSmartSummary(p),
                    deadline: this.detectDeadline(p)
                }));

                this.applyFilters();

            } catch (e) {
                showNotification(`Erro: ${e.message} `, 5000);
                els.empty.style.display = 'block';
                loadCaptcha(); // Retry captcha on error
            } finally {
                els.loading.style.display = 'none';
                els.syncBtn.disabled = false;
            }
        },

        calculatePriority: function (proc) {
            const text = (proc.descricao + ' ' + proc.tipo + ' ' + proc.interessados).toLowerCase();
            // High Priority
            if (text.match(/(urgente|liminar|mandado|prazo|imediato|prioridade|vencimento|atraso)/)) return 'high';
            // Medium Priority
            if (text.match(/(memorando|ofício|solicitação|pedido|requerimento)/)) return 'medium';
            return 'low';
        },

        classifyCategory: function (proc) {
            const text = (proc.descricao + ' ' + proc.tipo + ' ' + proc.interessados + ' ' + proc.unidade).toLowerCase();
            if (text.match(/(pagamento|fatura|nota fiscal|empenho|financeiro|compra)/)) return 'Financeiro';
            if (text.match(/(contrato|aditivo|licitação|pregão|jurídico|parecer|lei|decreto)/)) return 'Jurídico';
            if (text.match(/(servidor|férias|ponto|nomeação|exoneração|rh|pessoal)/)) return 'RH';
            if (text.match(/(sistema|ti|suporte|computador|rede|software)/)) return 'TI';
            return 'Geral';
        },

        generateSmartSummary: function (proc) {
            let text = proc.descricao || '';
            if (!text) return 'Sem informações detalhadas.';

            // Remove common prefixes
            text = text.replace(/^processo referente a\s*/i, '')
                .replace(/^trata-se de\s*/i, '')
                .replace(/^expediente sobre\s*/i, '');

            // If text is short, return as is
            if (text.length < 80) return text;

            // Try to grab the first significant sentence
            const sentences = text.split(/[.!?]\s+/);
            if (sentences.length > 0) return sentences[0] + '.';

            // Fallback truncation
            return text.substring(0, 80) + '...';
        },

        detectDeadline: function (proc) {
            const text = (proc.descricao + ' ' + proc.tipo).toLowerCase();
            // Look for dates in format DD/MM/YYYY or DD/MM
            const dateRegex = /(\d{2}\/\d{2}(?:\/\d{4})?)/g;
            const matches = text.match(dateRegex);

            if (matches) {
                // Parse dates and check if any is in the future or recent past
                const now = new Date();
                for (const dateStr of matches) {
                    const parts = dateStr.split('/');
                    let year = now.getFullYear();
                    if (parts.length === 3) year = parseInt(parts[2]);
                    const date = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));

                    // If date is valid and within next 30 days or past 7 days
                    const diffDays = (date - now) / (1000 * 60 * 60 * 24);
                    if (diffDays > -7 && diffDays < 30) {
                        return { date: dateStr, isUrgent: diffDays < 3, isOverdue: diffDays < 0 };
                    }
                }
            }
            return null;
        },

        calculateDaysElapsed: function (dateString) {
            if (!dateString) return null;
            // Expects DD/MM/YYYY
            const parts = dateString.split('/');
            if (parts.length !== 3) return null;
            const date = new Date(parts[2], parts[1] - 1, parts[0]);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },

        applyFilters: function () {
            this.filteredProcesses = this.allProcesses.filter(proc => {
                const matchesSearch = (proc.protocolo + proc.descricao + proc.tipo + proc.interessados).toLowerCase().includes(this.filters.search);
                const matchesPriority = this.filters.priority === 'all' || proc.priority === this.filters.priority;
                return matchesSearch && matchesPriority;
            });
            this.renderList();
        },

        renderList: function () {
            els.list.innerHTML = '';
            if (this.filteredProcesses.length > 0) {
                this.filteredProcesses.forEach(proc => {
                    renderProcessCard(proc, els.list, false, this);
                });
                els.list.style.display = 'block';
                els.empty.style.display = 'none';
            } else {
                els.list.style.display = 'none';
                els.empty.style.display = 'block';
                els.empty.innerHTML = '<p>Nenhum processo encontrado com os filtros atuais.</p>';
            }
            this.updateBatchToolbar(); // Update toolbar visibility after rendering
        },

        saveNote: function (protocolo, note) {
            this.notes[protocolo] = note;
            localStorage.setItem('pmos_sei_notes', JSON.stringify(this.notes));
            showNotification('Nota salva!', 2000);
        },

        getNote: function (protocolo) {
            return this.notes[protocolo] || '';
        }
    };

    initializeFileState(appState, "Dashboard SEI", "dashboard.sei", "sei-dashboard");
    winData.currentAppInstance = appState;
    appState.init();

    // Bind global actions
    els.syncBtn.onclick = () => appState.fetchProcessos();

    return winId;
}
