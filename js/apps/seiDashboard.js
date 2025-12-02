import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

// URL relativa para funcionar tanto local quanto no Netlify
const API_BASE = '/api/sei';

async function fetchCaptcha() {
    const res = await fetch(`${API_BASE}/auth/challenge`);
    if (!res.ok) throw new Error("Falha ao carregar Captcha");
    return await res.json();
}

async function fetchProcessos(usuario, senha, captcha, cookies, unidade_alvo, filtrar_meus) {
    const res = await fetch(`${API_BASE}/processos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            usuario, senha, captcha, cookies, unidade_alvo, filtrar_meus
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
            console.error(e);
            els.captchaPlaceholder.textContent = 'Erro';
        }
    };

    // Initial load
    loadCaptcha();

    els.refreshBtn.onclick = loadCaptcha;

    els.syncBtn.onclick = async () => {
        const user = els.user.value.trim();
        const pass = els.pass.value.trim();
        const captcha = els.captchaInput.value.trim();

        if (!user || !pass || !captcha) {
            showNotification("Preencha usuário, senha e captcha.", 3000);
            return;
        }

        localStorage.setItem('pmos_sei_user', user);

        els.loading.style.display = 'block';
        els.empty.style.display = 'none';
        els.list.style.display = 'none';
        els.syncBtn.disabled = true;

        try {
            const data = await fetchProcessos(user, pass, captcha, currentCookies, null, els.filter.checked);

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
