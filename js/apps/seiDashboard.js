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

    els.syncBtn.onclick = async () => {
        const user = els.user.value.trim();
        const pass = els.pass.value.trim();
        const orgao = els.orgao.value.trim();
        const captcha = els.captchaInput.value.trim();

        if (!user || !pass || !orgao) {
            showNotification("Preencha usuário, senha e órgão.", 3000);
            return;
        }

        localStorage.setItem('pmos_sei_user', user);

        els.loading.style.display = 'block';
        els.empty.style.display = 'none';
        els.list.style.display = 'none';
        els.syncBtn.disabled = true;

        try {
            const data = await fetchProcessos(user, pass, orgao, captcha);

            els.list.innerHTML = '';
            if (data.processos && data.processos.length > 0) {
                data.processos.forEach(proc => {
                    renderProcessCard(proc, els.list);
                });
                els.list.style.display = 'block';
            } else {
                els.empty.style.display = 'block';
                els.empty.innerHTML = '<p>Nenhum processo encontrado.</p>';
            }
        } catch (e) {
            showNotification(`Erro: ${e.message} `, 5000);
            els.empty.style.display = 'block';
            // Refresh captcha on error as it might be invalid now
            loadCaptcha();
        } finally {
            els.loading.style.display = 'none';
            els.syncBtn.disabled = false;
        }
    };

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

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex-grow: 1;">
                    <div style="display: flex; align-items: center;">
                        <a href="${proc.link_sei}" target="_blank" style="font-weight: bold; color: var(--accent-color); text-decoration: none; font-size: 1.1em;">${proc.protocolo}</a>
                        ${timelineBadge}
                        ${proc.priority === 'high' ? '<span style="font-size: 0.7em; background: #dc3545; color: white; padding: 1px 4px; border-radius: 3px; margin-left: 8px;">URGENTE</span>' : ''}
                    </div>
                    <div style="font-size: 0.9em; color: var(--text-color); margin-top: 4px; font-weight: 500;">
                        ${proc.tipo ? `<span style="color: var(--secondary-text-color); font-weight: normal;">${proc.tipo}</span><br>` : ''}
                        ${proc.descricao || 'Sem descrição'}
                    </div>
                </div>
                <div style="text-align: right; min-width: 100px;">
                    <span style="font-size: 0.8em; background: var(--button-bg); padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${proc.unidade}</span>
                    ${proc.data ? `<div style="font-size: 0.8em; color: var(--secondary-text-color); margin-top: 4px;">${proc.data}</div>` : ''}
                </div>
            </div>
            
            ${proc.interessados ? `<div style="font-size: 0.85em; color: var(--secondary-text-color); margin-top: 8px;"><strong>Interessados:</strong> ${proc.interessados}</div>` : ''}
            ${proc.atribuido_a ? `<div style="font-size: 0.85em; color: var(--secondary-text-color); margin-top: 2px;"><strong>Atribuído a:</strong> ${proc.atribuido_a}</div>` : ''}

            ${noteSection}

            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--separator-color); display: flex; gap: 8px;">
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

    const appState = {
        winId,
        appDataType: 'sei-dashboard',
        allProcesses: [],
        filteredProcesses: [],
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

            // Initial Load
            this.fetchProcessos();
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
                    daysElapsed: this.calculateDaysElapsed(p.data)
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
            if (text.includes('urgente') || text.includes('liminar') || text.includes('mandado') || text.includes('prazo')) return 'high';
            if (text.includes('memorando') || text.includes('ofício')) return 'medium';
            return 'low';
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

