import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

// URL relativa para funcionar tanto local quanto no Netlify
const API_BASE = '/api/sei';

async function fetchCaptcha() {
    const res = await fetch(`${API_BASE}/auth/challenge`);
    if (!res.ok) throw new Error("Falha ao carregar Captcha");
    return await res.json();
}

async function fetchProcessos(usuario, senha, orgao, captcha, cookies, unidade_alvo, filtrar_meus) {
    const res = await fetch(`${API_BASE}/processos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            usuario, senha, orgao, captcha, cookies, unidade_alvo, filtrar_meus
        })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erro ao buscar processos");
    }
    return await res.json();
}

export function openSeiDashboard() {
    const uniqueSuffix = generateId('sei');
    const winId = window.windowManager.createWindow('Dashboard SEI', '', { width: '900px', height: '650px', appType: 'sei-dashboard' });

    const content = `
        <div class="app-toolbar"> ${getStandardAppToolbarHTML()} </div>
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
            const data = await fetchProcessos(user, pass, orgao, captcha, currentCookies, null, els.filter.checked);

            els.list.innerHTML = '';
            if (data.processos && data.processos.length > 0) {
                data.processos.forEach(proc => {
                    const card = document.createElement('div');
                    card.className = 'sei-process-card';
                    card.style.cssText = `background: var(--window-bg); border: 1px solid var(--separator-color); border-radius: 6px; padding: 12px; margin-bottom: 10px;`;
                    card.innerHTML = `
                        <div style="display: flex; justify-content: space-between;">
                            <a href="${proc.link_sei}" target="_blank" style="font-weight: bold; color: var(--accent-color);">${proc.protocolo}</a>
                            <span style="font-size: 0.8em; background: var(--button-bg); padding: 2px 6px; border-radius: 4px;">${proc.unidade}</span>
                        </div>
                        <div style="font-size: 0.9em; margin-top: 5px;">${proc.interessados}</div>
                        <div style="font-size: 0.8em; color: var(--secondary-text-color); margin-top: 5px;">${proc.atribuido_a}</div>
                    `;
                    els.list.appendChild(card);
                });
                els.list.style.display = 'block';
            } else {
                els.empty.style.display = 'block';
                els.empty.innerHTML = '<p>Nenhum processo encontrado.</p>';
            }
        } catch (e) {
            showNotification(`Erro: ${e.message}`, 5000);
            els.empty.style.display = 'block';
            // Refresh captcha on error as it might be invalid now
            loadCaptcha();
        } finally {
            els.loading.style.display = 'none';
            els.syncBtn.disabled = false;
        }
    };

    const appState = {
        winId, appDataType: 'sei-dashboard',
        getData: function () { return {}; },
        loadData: function () { },
        cleanup: () => { }
    };

    initializeFileState(appState, "Dashboard SEI", "dashboard.sei", "sei-dashboard");
    winData.currentAppInstance = appState;
    setupAppToolbarActions(appState);

    return winId;
}
