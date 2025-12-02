import * as apps from './apps/index.js';
import * as appUtils from './apps/app.js';

// --- CONSTANTES GLOBAIS E UTILITÁRIOS ---

export const STORAGE_KEYS = {
    WALLPAPER: 'webosWallpaper_gestaop_v1.6',
    THEME_DARK_MODE: 'darkMode_gestaop_v1.6',
    THEME_ACCENT_COLOR: 'accentColor_gestaop_v1.6',
    MAP_NEURAL_STATE: 'webos_map_neural_state_v1.0',
    MAP_NEURAL_TRAINING_DATA: 'webos_map_neural_training_v1.0'
};

export function generateId(prefix = 'id') {
    return prefix + '_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

export function showNotification(message, duration = 3000) {
    const notificationElement = document.getElementById('notification');
    if (!notificationElement) {
        console.warn("Elemento de notificação '#notification' não encontrado.");
        return;
    }
    notificationElement.textContent = message;
    notificationElement.classList.add('show');
    setTimeout(() => {
        notificationElement.classList.remove('show');
    }, duration);
}


// --- CLASSES PRINCIPAIS DO SISTEMA ---

class WindowManager {
    constructor() {
        this.windows = new Map();
        this.zIndex = 100;
        this.activeWindowId = null;
        this.taskbarItemsContainer = document.getElementById('taskbarItems');
        this.stageManager = new StageManager(this);
        this.appLaunchActions = {};
    }

    /**
     * Lógica detalhada para ocultar/mostrar o Dock.
     * Esta função é o centro do comportamento de auto-ocultação.
     */

    updateDockVisibility() {
        const dock = document.getElementById('appDock');
        if (!dock) return;

        // A verificação de tela de celular foi removida.
        // A lógica a seguir agora vale para desktop e mobile.

        // O Dock só deve se esconder se houver PELO MENOS UMA janela aberta que NÃO esteja minimizada.
        let shouldHide = false;
        for (const winData of this.windows.values()) {
            if (!winData.minimized) {
                shouldHide = true; // Encontrou uma janela visível, então o Dock deve se esconder.
                break; // Não precisa verificar o resto, a condição foi atendida.
            }
        }

        // Aplicar a classe CSS com base na condição.
        // A classe 'hidden' tem o CSS que desliza o Dock para fora da tela.
        if (shouldHide) {
            dock.classList.add('hidden');
        } else {
            // Se não houver janelas visíveis (todas fechadas ou minimizadas), o Dock deve aparecer.
            dock.classList.remove('hidden');
        }
    }


    createWindow(title, content, options = {}) {
        const winId = generateId('win');
        this.zIndex++;

        const win = document.createElement('div');
        win.id = winId;
        win.className = 'window';
        win.style.width = options.width || '700px';
        win.style.height = options.height || '500px';

        const taskbarHeightVal = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-height'), 10) || 48;
        const maxLeft = window.innerWidth - parseInt(win.style.width, 10) - 20;
        const maxTop = window.innerHeight - parseInt(win.style.height, 10) - taskbarHeightVal - 20;
        win.style.left = options.left || `${Math.max(10, Math.random() * maxLeft)}px`;
        win.style.top = options.top || `${Math.max(10, Math.random() * maxTop)}px`;
        win.style.zIndex = this.zIndex;

        const titleBar = document.createElement('div');
        titleBar.className = 'title-bar';

        const controls = document.createElement('div');
        controls.className = 'window-controls';
        ['close', 'minimize', 'maximize'].forEach(type => {
            const btn = document.createElement('button');
            btn.className = `window-control ${type}`;
            btn.title = type.charAt(0).toUpperCase() + type.slice(1);
            btn.onclick = (e) => {
                e.stopPropagation();
                if (type === 'close') this.closeWindow(winId);
                else if (type === 'minimize') this.minimizeWindow(winId);
                else if (type === 'maximize') this.maximizeWindow(winId);
            };
            controls.appendChild(btn);
        });

        const titleText = document.createElement('span');
        titleText.className = 'window-title-text';
        titleText.textContent = title;

        const windowContent = document.createElement('div');
        windowContent.className = 'window-content';
        if (options.appType) {
            windowContent.classList.add(`${options.appType.split(' ')[0]}-app`);
            if (['swot-analysis', 'okr-tracker', 'contract-manager', 'gantt-chart',
                'ishikawa-diagram', 'bpmn-modeler', 'project-tasks', 'quality-tool',
                'kanban-board', 'sipoc-matrix'].some(type => options.appType.startsWith(type))) {
                windowContent.classList.add(`${options.appType.split(' ')[0]}-app-container`);
            }
        }

        if (typeof content === 'string') {
            windowContent.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            windowContent.appendChild(content);
        }

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';

        win.addEventListener('keydown', async (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                const activeWinData = this.windows.get(this.activeWindowId);
                if (activeWinData && activeWinData.currentAppInstance) {
                    await appUtils.handleSaveAction(activeWinData.currentAppInstance);
                }
            }
        });

        titleBar.appendChild(controls);
        titleBar.appendChild(titleText);

        win.appendChild(titleBar);
        win.appendChild(windowContent);
        win.appendChild(resizeHandle);

        document.getElementById('desktop').appendChild(win);

        const winData = {
            element: win,
            title: title,
            minimized: false,
            maximized: false,
            originalRect: null,
            appType: options.appType || 'generic',
            currentAppInstance: null,
            jmInstance: null,
            getScreenshot: async () => {
                try {
                    const controlsEl = win.querySelector('.window-controls');
                    const resizeHandleEl = win.querySelector('.resize-handle');
                    if (controlsEl) controlsEl.style.visibility = 'hidden';
                    if (resizeHandleEl) resizeHandleEl.style.visibility = 'hidden';

                    const canvas = await html2canvas(win, {
                        scale: 0.25, logging: false, useCORS: true,
                        width: win.offsetWidth, height: win.offsetHeight,
                        windowWidth: win.scrollWidth, windowHeight: win.scrollHeight,
                        foreignObjectRendering: true, removeContainer: true,
                        backgroundColor: null
                    });
                    if (controlsEl) controlsEl.style.visibility = 'visible';
                    if (resizeHandleEl) resizeHandleEl.style.visibility = 'visible';
                    return canvas.toDataURL('image/png');
                } catch (err) {
                    console.warn("Erro ao gerar screenshot da janela:", err, winData.title);
                    const appIconActionKey = `open-${winData.appType.replace(/([A-Z])/g, '-$1').toLowerCase().split(' ')[0]}`;
                    const appIconEl = document.querySelector(`.dock-item[data-action="${appIconActionKey}"]`);
                    const appIconText = appIconEl ? appIconEl.textContent : '⚙️';
                    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--button-bg').trim();
                    const fgColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
                    return `data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="75" viewBox="0 0 100 75"><rect width="100" height="75" fill="${bgColor}"/><text x="50" y="45" font-size="30" text-anchor="middle" dominant-baseline="middle" fill="${fgColor}">${appIconText || '🖼️'}</text><text x="50" y="65" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="${fgColor}">${winData.title.substring(0, 12)}</text></svg>`;
                }
            }
        };
        this.windows.set(winId, winData);
        this.makeActive(winId);
        this._addDragAndResize(win, titleBar, resizeHandle, winId);
        this._createTaskbarItem(winId, title, options.appType);

        win.addEventListener('mousedown', () => this.makeActive(winId));
        if (this.stageManager.isActive) this.stageManager.updateStageThumbnails();
        this.updateDockVisibility();
        return winId;
    }

    makeActive(winId) {
        if (this.activeWindowId && this.windows.has(this.activeWindowId)) {
            this.windows.get(this.activeWindowId).element.classList.remove('active');
        }
        if (this.windows.has(winId)) {
            const winData = this.windows.get(winId);
            this.zIndex++;
            winData.element.style.zIndex = this.zIndex;
            winData.element.classList.add('active');
            this.activeWindowId = winId;
            this._updateTaskbarActiveState(winId);
            if (this.stageManager.isActive) {
                this.stageManager.focusApp(winId);
            }
        }
    }

    closeWindow(winId) {
        if (this.windows.has(winId)) {
            const winData = this.windows.get(winId);
            if (winData.currentAppInstance && winData.currentAppInstance.isDirty) {
                if (!confirm('Você possui alterações não salvas nesta janela. Deseja fechar mesmo assim e descartar as alterações?')) {
                    return;
                }
            }
            if (winData.currentAppInstance && typeof winData.currentAppInstance.cleanup === 'function') {
                winData.currentAppInstance.cleanup();
            }
            if (winData.jmInstance && typeof winData.jmInstance.destroy === 'function') {
                winData.jmInstance = null;
            }
            winData.element.remove();
            this.windows.delete(winId);
            this._removeTaskbarItem(winId);
            if (this.activeWindowId === winId) this.activeWindowId = null;
            if (this.stageManager.isActive) this.stageManager.updateStageThumbnails();
            this.updateDockVisibility();
        }
    }

    minimizeWindow(winId) {
        if (this.windows.has(winId)) {
            const winData = this.windows.get(winId);
            const dock = document.getElementById('appDock');
            const dockRect = dock.getBoundingClientRect();
            const targetX = dockRect.left + (dockRect.width / 2);
            const targetY = dockRect.top + (dockRect.height / 2);
            winData.element.style.transformOrigin = `${targetX - winData.element.offsetLeft}px ${targetY - winData.element.offsetTop}px`;
            winData.element.classList.add('minimized');
            winData.minimized = true;
            this._updateTaskbarItemVisual(winId, true);
            if (this.stageManager.isActive) this.stageManager.updateStageThumbnails();
            this.updateDockVisibility();
        }
    }

    maximizeWindow(winId) {
        if (this.windows.has(winId)) {
            const winData = this.windows.get(winId);
            const winEl = winData.element;
            if (winData.maximized) {
                winEl.classList.remove('maximized');
                if (winData.originalRect) {
                    winEl.style.width = winData.originalRect.width;
                    winEl.style.height = winData.originalRect.height;
                    winEl.style.top = winData.originalRect.top;
                    winEl.style.left = winData.originalRect.left;
                }
                winData.maximized = false;
            } else {
                winData.originalRect = {
                    width: winEl.style.width, height: winEl.style.height,
                    top: winEl.style.top, left: winEl.style.left
                };
                winEl.classList.add('maximized');
                winData.maximized = true;
            }
            if (this.stageManager.isActive) this.stageManager.updateStageThumbnails();
            this.updateDockVisibility();
        }
    }

    restoreWindow(winId) {
        if (this.windows.has(winId)) {
            const winData = this.windows.get(winId);
            winData.element.style.transformOrigin = 'bottom center';
            winData.element.classList.remove('minimized');
            winData.minimized = false;
            this.makeActive(winId);
            this._updateTaskbarItemVisual(winId, false);
            if (this.stageManager.isActive) this.stageManager.updateStageThumbnails();
            this.updateDockVisibility();
        }
    }

    updateWindowTitle(winId, newTitle) {
        if (this.windows.has(winId)) {
            const winData = this.windows.get(winId);
            winData.title = newTitle;
            winData.element.querySelector('.window-title-text').textContent = newTitle;
            this._updateTaskbarItemTitle(winId, newTitle);
            if (this.stageManager.isActive) this.stageManager.updateStageThumbnails();
        }
    }

    _addDragAndResize(win, titleBar, resizeHandle, winId) {
        let offsetX, offsetY;
        titleBar.onmousedown = (e) => {
            if (e.target.classList.contains('window-control') || e.target.closest('.window-control')) return;
            const winData = this.windows.get(winId);
            if (winData.maximized || (this.stageManager.isActive && this.stageManager.focusedAppId === winId)) return;
            this.makeActive(winId);
            offsetX = e.clientX - win.offsetLeft;
            offsetY = e.clientY - win.offsetTop;
            document.body.classList.add('dragging');
            win.classList.add('dragging');
            document.onmousemove = (moveEvent) => {
                win.style.left = `${moveEvent.clientX - offsetX}px`;
                win.style.top = `${moveEvent.clientY - offsetY}px`;
            };
            document.onmouseup = () => {
                document.onmousemove = document.onmouseup = null;
                document.body.classList.remove('dragging');
                win.classList.remove('dragging');
            };
        };

        resizeHandle.onmousedown = (e) => {
            e.preventDefault();
            const winData = this.windows.get(winId);
            if (winData.maximized || (this.stageManager.isActive && this.stageManager.focusedAppId === winId)) return;
            this.makeActive(winId);
            const initialWidth = win.offsetWidth;
            const initialHeight = win.offsetHeight;
            const initialMouseX = e.clientX;
            const initialMouseY = e.clientY;
            document.body.classList.add('resizing');
            win.classList.add('resizing');

            document.onmousemove = (moveEvent) => {
                const newWidth = initialWidth + (moveEvent.clientX - initialMouseX);
                const newHeight = initialHeight + (moveEvent.clientY - initialMouseY);
                win.style.width = `${Math.max(parseInt(getComputedStyle(win).minWidth), newWidth)}px`;
                win.style.height = `${Math.max(parseInt(getComputedStyle(win).minHeight), newHeight)}px`;
            };
            document.onmouseup = () => {
                document.onmousemove = document.onmouseup = null;
                document.body.classList.remove('resizing');
                win.classList.remove('resizing');
                if (this.stageManager.isActive) this.stageManager.updateStageThumbnails();
            };
        };
    }

    _createTaskbarItem(winId, title, appType) {
        const item = document.createElement('div');
        item.className = 'taskbar-item';
        item.id = `taskbar-item-${winId}`;
        let actionKeyBase = appType ? appType.replace(/([A-Z])/g, '-$1').toLowerCase().split(' ')[0] : 'generic';
        let actionKey = `open-${actionKeyBase}`;
        if (!this.appLaunchActions[actionKey] && this.appLaunchActions[`new-${actionKeyBase}`]) {
            actionKey = `new-${actionKeyBase}`;
        } else if (!this.appLaunchActions[actionKey]) {
            const allActionKeys = Object.keys(this.appLaunchActions);
            const matchingActionKey = allActionKeys.find(k => k.endsWith(actionKeyBase));
            if (matchingActionKey) actionKey = matchingActionKey;
            else actionKey = null;
        }
        const appIconEl = actionKey ? document.querySelector(`.dock-item[data-action="${actionKey}"]`) : null;
        const appIconText = appIconEl ? appIconEl.textContent : '⚙️';


        item.innerHTML = `<span class="taskbar-item-icon" style="font-size: 1.2em; margin-right: 5px;">${appIconText}</span> <span class="taskbar-item-title">${title}</span>`;
        item.title = title;

        item.onclick = () => {
            const winData = this.windows.get(winId);
            if (this.stageManager.isActive) {
                this.stageManager.focusApp(winId);
                if (winData.minimized) this.restoreWindow(winId);
            } else {
                if (winData.minimized) this.restoreWindow(winId);
                else if (this.activeWindowId === winId) this.minimizeWindow(winId);
                else this.makeActive(winId);
            }
        };
        item.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); this._showTaskbarItemContextMenu(e, winId, item); };
        this.taskbarItemsContainer.appendChild(item);
        this._updateTaskbarActiveState(winId);
    }

    _showTaskbarItemContextMenu(event, winId, taskbarItemElement) {
        const existingMenu = document.getElementById('taskbarContext');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'taskbarContext';
        menu.className = 'taskbar-item-context-menu';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = `<i class="fas fa-times" style="margin-right: 5px;"></i> Fechar Janela`;
        closeButton.onclick = (e) => { e.stopPropagation(); this.closeWindow(winId); menu.remove(); };
        menu.appendChild(closeButton);

        document.body.appendChild(menu);
        const menuRect = menu.getBoundingClientRect();
        const itemRect = taskbarItemElement.getBoundingClientRect();
        let top = itemRect.top - menuRect.height - 5;
        let left = itemRect.left + (itemRect.width / 2) - (menuRect.width / 2);

        if (top < 0) top = itemRect.bottom + 5;
        if (left < 0) left = 5;
        if (left + menuRect.width > window.innerWidth) left = window.innerWidth - menuRect.width - 5;

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.display = 'block';

        const closeMenuHandler = (clickEvent) => {
            if (!menu.contains(clickEvent.target)) {
                if (menu.parentNode) menu.remove();
                document.removeEventListener('click', closeMenuHandler, true);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenuHandler, true), 0);
    }

    _removeTaskbarItem(winId) { const item = document.getElementById(`taskbar-item-${winId}`); if (item) item.remove(); }
    _updateTaskbarItemTitle(winId, newTitle) { const item = document.getElementById(`taskbar-item-${winId}`); if (item) { const titleEl = item.querySelector('.taskbar-item-title'); if (titleEl) titleEl.textContent = newTitle; item.title = newTitle; } }
    _updateTaskbarActiveState(winIdToActivate) { this.taskbarItemsContainer.querySelectorAll('.taskbar-item').forEach(item => item.classList.remove('active')); const activeItem = document.getElementById(`taskbar-item-${winIdToActivate}`); if (activeItem) activeItem.classList.add('active'); }
    _updateTaskbarItemVisual(winId, isMinimized) { const item = document.getElementById(`taskbar-item-${winId}`); if (item) { item.style.opacity = isMinimized ? '0.7' : '1'; } }
}

class ThemeManager {
    constructor(palettes) {
        this.isDark = localStorage.getItem(STORAGE_KEYS.THEME_DARK_MODE) === 'true';
        this.accentColor = localStorage.getItem(STORAGE_KEYS.THEME_ACCENT_COLOR) || (this.isDark ? 'var(--accent-dark)' : 'var(--accent-light)');
        this.palettes = palettes;
        this._applyInitialTheme();
    }
    _applyInitialTheme() {
        if (this.isDark) document.body.classList.add('dark-mode');
        this._setAccentColorVariableInternal(this.accentColor);
        this.applyThemeVariables();
    }
    toggleDarkMode() {
        this.isDark = !this.isDark;
        document.body.classList.toggle('dark-mode');
        localStorage.setItem(STORAGE_KEYS.THEME_DARK_MODE, this.isDark);
        if (this.accentColor === (this.isDark ? 'var(--accent-light)' : 'var(--accent-dark)')) {
            this.setAccentColor(this.isDark ? 'var(--accent-dark)' : 'var(--accent-light)');
        } else {
            this.applyThemeVariables();
        }
        this._updatePaletteSelection();
        window.windowManager.windows.forEach(winData => {
            if (winData.appType === 'mindmap' && winData.jmInstance) {
                winData.jmInstance.set_theme(this.isDark ? 'dark' : 'primary');
            }
        });
    }
    setAccentColor(colorNameOrValue) {
        this._setAccentColorVariableInternal(colorNameOrValue);
        this.accentColor = colorNameOrValue;
        localStorage.setItem(STORAGE_KEYS.THEME_ACCENT_COLOR, colorNameOrValue);
        this.applyThemeVariables();
        this._updatePaletteSelection();
    }
    _setAccentColorVariableInternal(colorVarOrHex) {
        const rootEl = document.documentElement;
        let actualColorValue = colorVarOrHex;
        if (colorVarOrHex.startsWith('var(--')) {
            actualColorValue = getComputedStyle(document.documentElement).getPropertyValue(colorVarOrHex.replace('var(', '').replace(')', '')).trim();
        }
        document.documentElement.style.setProperty('--accent-color', actualColorValue);
        rootEl.style.setProperty('--accent-light', actualColorValue);
        rootEl.style.setProperty('--accent-dark', actualColorValue);
        if (actualColorValue.startsWith('#')) {
            const r = parseInt(actualColorValue.slice(1, 3), 16);
            const g = parseInt(actualColorValue.slice(3, 5), 16);
            const b = parseInt(actualColorValue.slice(5, 7), 16);
            document.documentElement.style.setProperty('--accent-light-translucent', `rgba(${r},${g},${b},0.1)`);
            document.documentElement.style.setProperty('--accent-dark-translucent', `rgba(${r},${g},${b},0.15)`);
        } else if (actualColorValue.startsWith('rgba')) {
            const match = actualColorValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (match) {
                document.documentElement.style.setProperty('--accent-light-translucent', `rgba(${match[1]},${match[2]},${match[3]},0.1)`);
                document.documentElement.style.setProperty('--accent-dark-translucent', `rgba(${match[1]},${match[2]},${match[3]},0.15)`);
            }
        }
    }
    applyThemeVariables() {
        const root = document.documentElement;
        const themePrefix = this.isDark ? 'dark' : 'light';
        const propsToUpdate = ['background', 'text-color', 'secondary-text-color', 'window-bg', 'toolbar-bg', 'button-bg', 'button-text-color', 'input-bg', 'input-border-color', 'separator-color', 'hover-highlight-color', 'current-window-bg-rgb', 'current-background-rgb-for-stage'];
        propsToUpdate.forEach(prop => {
            let varName = prop.replace('-color', '').replace('-rgb', '').replace('-for-stage', '');
            let cssVarName = `--${varName}-${themePrefix}`;
            if (prop.includes('-rgb')) cssVarName += '-rgb';
            root.style.setProperty(`--${prop}`, `var(${cssVarName})`);
        });
        this._updateUIColorDependents();
    }
    _updateUIColorDependents() {
        window.windowManager.windows.forEach(winData => {
            if (winData.appType === 'mindmap' && winData.jmInstance) {
                winData.jmInstance.set_theme(this.isDark ? 'dark' : 'primary');
                const bgColorPicker = winData.element.querySelector('input[id^="bgColorPicker_"]');
                const fgColorPicker = winData.element.querySelector('input[id^="fgColorPicker_"]');
                if (bgColorPicker) bgColorPicker.value = this.isDark ? '#555555' : '#FFFFFF';
                if (fgColorPicker) fgColorPicker.value = this.isDark ? '#FFFFFF' : '#000000';
            }
        });
    }
    _setupAccentPalette() {
        const paletteContainer = document.getElementById('accentColorPaletteMenu');
        const darkModeToggle = document.getElementById('darkModeToggleMenu');
        if (!paletteContainer || !darkModeToggle) return;
        paletteContainer.innerHTML = '';
        const currentPalette = this.isDark ? this.palettes.dark : this.palettes.light;
        currentPalette.forEach(item => {
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            colorOption.style.backgroundColor = item.color.startsWith('var(') ?
                getComputedStyle(document.documentElement).getPropertyValue(item.color.replace('var(', '').replace(')', '')).trim() :
                item.color;
            colorOption.title = item.name;
            colorOption.dataset.colorValue = item.color;
            colorOption.onclick = (e) => { e.stopPropagation(); this.setAccentColor(item.color); };
            paletteContainer.appendChild(colorOption);
        });
        darkModeToggle.checked = this.isDark;
        const newDarkModeToggle = darkModeToggle.cloneNode(true);
        darkModeToggle.parentNode.replaceChild(newDarkModeToggle, darkModeToggle);
        newDarkModeToggle.onchange = (e) => { e.stopPropagation(); this.toggleDarkMode(); this._setupAccentPalette(); };
        this._updatePaletteSelection();
    }
    _updatePaletteSelection() {
        const paletteContainer = document.getElementById('accentColorPaletteMenu');
        if (!paletteContainer) return;
        paletteContainer.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        const selectedOption = paletteContainer.querySelector(`.color-option[data-color-value="${this.accentColor}"]`);
        if (selectedOption) selectedOption.classList.add('selected');
    }
}

class StageManager {
    constructor(windowMgr) { this.windowManager = windowMgr; this.isActive = false; this.overlay = document.getElementById('stageManagerOverlay'); this.sidebar = document.getElementById('stageManagerSidebar'); this.mainArea = document.getElementById('stageManagerMainArea'); this.toggleButton = document.getElementById('stageManagerToggle'); this.focusedAppId = null; this.originalWindowStates = new Map(); if (this.toggleButton) this.toggleButton.onclick = () => this.toggle(); }
    toggle() { this.isActive = !this.isActive; this.overlay.classList.toggle('active', this.isActive); if (this.toggleButton) this.toggleButton.classList.toggle('active', this.isActive); if (this.isActive) { this.windowManager.windows.forEach((winData, winId) => { if (!winData.minimized && winData.element.style.display !== 'none') { this.originalWindowStates.set(winId, { left: winData.element.style.left, top: winData.element.style.top, width: winData.element.style.width, height: winData.element.style.height, zIndex: winData.element.style.zIndex, transform: winData.element.style.transform || '' }); } }); const activeOrFirstVisible = this.windowManager.activeWindowId || Array.from(this.windowManager.windows.keys()).find(id => !this.windowManager.windows.get(id).minimized && this.windowManager.windows.get(id).element.style.display !== 'none'); if (activeOrFirstVisible) { this.focusApp(activeOrFirstVisible); } else { this.updateStageThumbnails(); } } else { this.restoreWindows(); this.originalWindowStates.clear(); } }
    async updateStageThumbnails() { if (!this.sidebar) return; this.sidebar.innerHTML = ''; const openWindows = []; this.windowManager.windows.forEach(winData => { if (!winData.minimized && winData.element.style.display !== 'none') { openWindows.push(winData); } }); for (const winData of openWindows) { if (winData.element.id === this.focusedAppId && this.isActive) continue; const thumb = document.createElement('div'); thumb.className = 'stage-app-thumbnail'; thumb.dataset.winId = winData.element.id; const titleSpan = document.createElement('span'); titleSpan.className = 'thumbnail-title'; titleSpan.textContent = winData.title.substring(0, 15) + (winData.title.length > 15 ? '...' : ''); try { const screenshotSrc = await winData.getScreenshot(); if (screenshotSrc.startsWith('data:image/svg+xml')) { const tempDiv = document.createElement('div'); tempDiv.innerHTML = screenshotSrc; const svgEl = tempDiv.firstChild; if (svgEl.querySelector('text:last-child')) svgEl.querySelector('text:last-child').textContent = titleSpan.textContent; thumb.appendChild(svgEl); } else { const img = document.createElement('img'); img.src = screenshotSrc; img.alt = winData.title; thumb.appendChild(img); thumb.appendChild(titleSpan); } } catch (e) { const appIconActionKey = `open-${winData.appType.replace(/([A-Z])/g, '-$1').toLowerCase().split(' ')[0]}`; const appIconEl = document.querySelector(`.dock-item[data-action="${appIconActionKey}"]`); const appIconText = appIconEl ? appIconEl.textContent : '⚙️'; thumb.innerHTML = `<div class="placeholder-icon">${appIconText}</div>`; thumb.appendChild(titleSpan); } thumb.onclick = () => { if (this.isActive) this.focusApp(winData.element.id); else this.windowManager.makeActive(winData.element.id); }; this.sidebar.appendChild(thumb); } }
    focusApp(winId) { this.focusedAppId = winId; this.windowManager.windows.forEach((winData, id) => { const winEl = winData.element; if (id === winId) { winEl.style.display = 'flex'; const mainAreaRect = this.mainArea.getBoundingClientRect(); const sidebarWidth = this.sidebar.offsetWidth + 20; const availableWidth = mainAreaRect.width - (this.isActive ? sidebarWidth : 0); let targetWidth = Math.min(parseFloat(this.originalWindowStates.get(id)?.width || winEl.offsetWidth), availableWidth * 0.75); let targetHeight = (targetWidth / parseFloat(this.originalWindowStates.get(id)?.width || winEl.offsetWidth)) * parseFloat(this.originalWindowStates.get(id)?.height || winEl.offsetHeight); if (targetHeight > mainAreaRect.height * 0.85) { targetHeight = mainAreaRect.height * 0.85; targetWidth = (targetHeight / parseFloat(this.originalWindowStates.get(id)?.height || winEl.offsetHeight)) * parseFloat(this.originalWindowStates.get(id)?.width || winEl.offsetWidth); } winEl.style.width = `${targetWidth}px`; winEl.style.height = `${targetHeight}px`; winEl.style.left = `${(this.isActive ? sidebarWidth : 0) + (availableWidth - targetWidth) / 2}px`; winEl.style.top = `${(mainAreaRect.height - targetHeight) / 2}px`; winEl.style.transform = 'scale(1)'; } else { winEl.style.display = 'none'; } }); this.updateStageThumbnails(); }
    restoreWindows() { this.windowManager.windows.forEach((winData, winId) => { const originalState = this.originalWindowStates.get(winId); if (originalState) { winData.element.style.left = originalState.left; winData.element.style.top = originalState.top; winData.element.style.width = originalState.width; winData.element.style.height = originalState.height; winData.element.style.zIndex = originalState.zIndex; winData.element.style.transform = originalState.transform; } if (!winData.minimized) winData.element.style.display = 'flex'; }); this.focusedAppId = null; if (window.windowManager.activeWindowId) window.windowManager.makeActive(window.windowManager.activeWindowId); this.updateStageThumbnails(); }
}

// --- INICIALIZAÇÃO E EVENTOS GLOBAIS ---

const accentPalettes = { light: [{ name: "Azul Padrão", color: "var(--accent-light)" }, { name: "Rosa", color: "#FF2D55" }, { name: "Verde", color: "#34C759" }, { name: "Laranja", color: "#FF9500" }, { name: "Roxo", color: "#AF52DE" }, { name: "Amarelo", color: "#FFCC00" }, { name: "Grafite", color: "#8E8E93" }, { name: "Ciano", color: "#5AC8FA" }], dark: [{ name: "Azul Padrão", color: "var(--accent-dark)" }, { name: "Rosa", color: "#FF375F" }, { name: "Verde", color: "#30D158" }, { name: "Laranja", color: "#FF9F0A" }, { name: "Roxo", color: "#BF5AF2" }, { name: "Amarelo", color: "#FFD60A" }, { name: "Grafite", color: "#98989D" }, { name: "Ciano", color: "#64D2FF" }] };

export function initializeWebOS() {
    if (window.webOSInitialized) return;
    window.webOSInitialized = true;

    window.windowManager = new WindowManager();
    window.themeManager = new ThemeManager(accentPalettes);

    updateClockTime();
    setInterval(updateClockTime, 10000);

    window.addEventListener('beforeunload', (e) => {
        let hasUnsavedChanges = false;
        window.windowManager.windows.forEach(winData => { if (winData.currentAppInstance?.isDirty) hasUnsavedChanges = true; });
        if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; }
    });

    window.addEventListener('resize', () => window.windowManager.updateDockVisibility());

    window.windowManager.appLaunchActions = {
        'open-login': () => window.authManager && window.authManager.openLoginModal && window.authManager.openLoginModal(),
        'open-file-system': apps.openFileSystem,
        'open-gantt-chart': apps.openGanttChart,
        'open-project-tasks': apps.openProjectTasks,
        'open-kanban-board': apps.openKanbanBoard,
        'open-swot-analysis': apps.openSWOTAnalysis,
        'open-sipoc-matrix': apps.openSIPOCMatrix,
        'open-okr-tracker': apps.openOKRTracker,
        'open-ishikawa-diagram': apps.openIshikawaDiagram,
        'open-bpmn-modeler': apps.openBPMNModeler,
        'open-mind-map': apps.openMindMap,
        'open-contract-manager': apps.openContractManager,
        'open-checklist-tool': apps.openChecklistTool,
        'open-ncr-tool': apps.openNCRTool,
        'open-pdca-tool': apps.openPDCATool,
        'open-5w2h-tool': apps.open5W2HTool,
        'open-sei-dashboard': apps.openSeiDashboard
    };

    document.querySelectorAll('#appDock .dock-item[data-action]').forEach(item => {
        const action = item.dataset.action;
        if (window.windowManager.appLaunchActions[action]) {
            item.onclick = (e) => { e.stopPropagation(); window.windowManager.appLaunchActions[action](); };
        }
    });

    const desktopEl = document.getElementById('desktop');
    if (desktopEl) {
        desktopEl.oncontextmenu = (e) => { e.preventDefault(); showDesktopContextMenu(e.clientX, e.clientY); };
    }
    document.onclick = (e) => { const dm = document.getElementById('desktopContextMenu'); if (dm && dm.style.display === 'block' && !dm.contains(e.target)) { hideDesktopContextMenu(); } };
    document.addEventListener('keydown', (e) => { if (e.key === "Escape") { hideDesktopContextMenu(); if (window.windowManager.stageManager.isActive) window.windowManager.stageManager.toggle(); } });

    const savedWallpaper = localStorage.getItem(STORAGE_KEYS.WALLPAPER);
    if (savedWallpaper) document.body.style.backgroundImage = `url(${savedWallpaper})`;

    window.themeManager.applyThemeVariables();
    document.getElementById('darkModeToggle').onclick = () => window.themeManager.toggleDarkMode();

    const wallpaperInput = document.getElementById('wallpaperInput');
    if (wallpaperInput) {
        wallpaperInput.addEventListener('change', e => {
            if (!e.target.files || !e.target.files[0] || !e.target.files[0].type.startsWith('image/')) {
                if (e.target.files && e.target.files[0]) {
                    showNotification("Por favor, selecione um arquivo de imagem válido.", 3000);
                }
                return;
            }

            const reader = new FileReader();
            reader.onload = ev => {
                document.body.style.backgroundImage = `url(${ev.target.result})`;
                localStorage.setItem(STORAGE_KEYS.WALLPAPER, ev.target.result);
                showNotification("Papel de parede alterado!", 2500);
            };
            reader.readAsDataURL(e.target.files[0]);
        });
    }

    const contextMenuHTML = `<div class="context-menu-item" data-action="open-file-system"><i class="fas fa-folder"></i> Explorador (Nuvem)</div><div class="context-menu-separator"></div><div class="context-menu-item" data-action="toggle-theme-settings"><i class="fas fa-palette"></i> Aparência</div><div class="context-menu-color-palette-container" id="contextMenuColorPaletteContainer" style="display: none;"><div class="context-menu-color-palette" id="accentColorPaletteMenu"></div><div style="padding: 8px 14px; display:flex; align-items:center; justify-content: space-between;"><span style="font-size:0.9em;">Modo Escuro</span><label class="switch" for="darkModeToggleMenu"><input type="checkbox" id="darkModeToggleMenu"><span class="slider round"></span></label></div></div><div class="context-menu-separator"></div><div class="context-menu-item" data-action="choose-wallpaper"><i class="fas fa-image"></i> Alterar Papel de Parede</div><div class="context-menu-item" data-action="show-desktop"><i class="fas fa-desktop"></i> Mostrar Área de Trabalho</div><div class="context-menu-separator"></div><div class="context-menu-item" data-action="shutdown"><i class="fas fa-power-off"></i> Sair da Conta</div>`;
    const desktopContextMenuEl = document.getElementById('desktopContextMenu');
    if (desktopContextMenuEl) desktopContextMenuEl.innerHTML = contextMenuHTML;
    setupDesktopContextMenuListeners();

    if (window.mapNeuralManager) {
        window.mapNeuralManager.loadState();
    }

    const dockEl = document.getElementById('appDock');
    const triggerArea = document.getElementById('dock-trigger-area');

    // @CORRIGIDO - A lógica de mouseenter/mouseleave agora é condicional ao tamanho da tela,
    // evitando conflitos de eventos na visualização mobile.
    if (dockEl && triggerArea) {
        triggerArea.addEventListener('mouseenter', () => {
            const isMobileScreen = window.innerWidth <= 768;
            if (!isMobileScreen) {
                dockEl.classList.remove('hidden');
            }
        });

        dockEl.addEventListener('mouseleave', () => {
            window.windowManager.updateDockVisibility();
        });
    }

    window.windowManager.updateDockVisibility();

    showNotification(`Bem-vindo(a) de volta!`, 3500);
}

function updateClockTime() { const clockEl = document.getElementById('clock'); if (clockEl) clockEl.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

function chooseWallpaper() {
    const wallpaperInput = document.getElementById('wallpaperInput');
    if (wallpaperInput) {
        wallpaperInput.click();
    }
}
function showDesktop() { window.windowManager.windows.forEach((wData, winId) => { if (!wData.minimized) window.windowManager.minimizeWindow(winId); }); }
function shutdown() {
    let hasUnsavedChanges = false;
    window.windowManager.windows.forEach(winData => { if (winData.currentAppInstance?.isDirty) hasUnsavedChanges = true; });
    let confirmMsg = 'Deseja realmente sair da sua conta?';
    if (hasUnsavedChanges) {
        confirmMsg = 'Você possui alterações não salvas que serão perdidas. Deseja mesmo sair?';
    }
    if (confirm(confirmMsg)) {
        window.authManager.signOut();
    }
}

let desktopMenuInitialized = false;
function setupDesktopContextMenuListeners() {
    const deskMenu = document.getElementById('desktopContextMenu');
    const colorPaletteContainer = document.getElementById('contextMenuColorPaletteContainer');
    if (!deskMenu || !colorPaletteContainer) return;
    if (desktopMenuInitialized) return;
    deskMenu.querySelectorAll('div.context-menu-item[data-action]').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            if (action === 'toggle-theme-settings') {
                const isDisplayed = colorPaletteContainer.style.display === 'block';
                colorPaletteContainer.style.display = isDisplayed ? 'none' : 'block';
                if (!isDisplayed) window.themeManager._setupAccentPalette();
                return;
            }
            const globalActions = { 'open-file-system': apps.openFileSystem, 'choose-wallpaper': chooseWallpaper, 'show-desktop': showDesktop, 'shutdown': shutdown };
            if (globalActions[action]) globalActions[action]();
            if (action !== 'toggle-theme-settings') hideDesktopContextMenu();
        };
    });
    desktopMenuInitialized = true;
}

function showDesktopContextMenu(x, y) {
    const deskMenu = document.getElementById('desktopContextMenu'); if (!deskMenu) return; if (!desktopMenuInitialized) setupDesktopContextMenuListeners();
    window.themeManager._setupAccentPalette(); const colorPaletteContainer = document.getElementById('contextMenuColorPaletteContainer'); if (colorPaletteContainer) colorPaletteContainer.style.display = 'none';
    deskMenu.style.left = `${x}px`; deskMenu.style.top = `${y}px`; deskMenu.style.display = 'block'; const menuRect = deskMenu.getBoundingClientRect(); const taskbarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-height'), 10) || 0;
    if (menuRect.right > window.innerWidth) deskMenu.style.left = `${Math.max(0, x - menuRect.width)}px`;
    if (menuRect.bottom > (window.innerHeight - taskbarHeight)) deskMenu.style.top = `${Math.max(0, y - menuRect.height)}px`;
    deskMenu.style.zIndex = (window.windowManager.zIndex || 100) + 5000;
}
function hideDesktopContextMenu() { const dm = document.getElementById('desktopContextMenu'); if (dm) dm.style.display = 'none'; }
let longPressTimer, touchStartX, touchStartY; const longPressDuration = 700;
document.getElementById('desktop').addEventListener('touchstart', (e) => { if (e.touches.length > 1) return; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; longPressTimer = setTimeout(() => { if (longPressTimer) { e.preventDefault(); showDesktopContextMenu(touchStartX, touchStartY); } }, longPressDuration); }, { passive: false });
function clearLongPressTimer() { clearTimeout(longPressTimer); longPressTimer = null; }
document.getElementById('desktop').addEventListener('touchend', clearLongPressTimer); document.getElementById('desktop').addEventListener('touchcancel', clearLongPressTimer);
document.getElementById('desktop').addEventListener('touchmove', (e) => { if (longPressTimer && touchStartX && touchStartY && (Math.abs(e.touches[0].clientX - touchStartX) > 10 || Math.abs(e.touches[0].clientY - touchStartY) > 10)) clearLongPressTimer(); });


/* Inicialização em modo convidado: o OS inicia independente de login */
document.addEventListener('DOMContentLoaded', () => {
    try { if (!window.webOSInitialized) initializeWebOS(); } catch (e) { console.error(e); }
});
