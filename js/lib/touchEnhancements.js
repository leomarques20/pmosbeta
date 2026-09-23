// Registrado imediatamente (e não no 'load', que espera todos os recursos externos/CDN).
// This needs to be delegated since windows are created dynamically
document.addEventListener('pointerdown', e => {
    if (!(e.target instanceof Element)) return;
    const titleBar = e.target.closest('.title-bar');
    if (titleBar) {
        handleTitleBarPointerDown(e, titleBar);
    }
    const resizeHandle = e.target.closest('.resize-handle');
    if (resizeHandle) {
        handleResizeHandlePointerDown(e, resizeHandle);
    }
});

// Arrastar/redimensionar com mouse já é tratado pelo WindowManager (main.js);
// aqui cuidamos apenas de toque/caneta, evitando dois manipuladores movendo a mesma janela.
function isWindowLockedForPointerDrag(win) {
    const stageManager = window.windowManager && window.windowManager.stageManager;
    return win.classList.contains('maximized') || (stageManager && stageManager.isActive && stageManager.focusedAppId === win.id);
}

function handleTitleBarPointerDown(e, titleBar) {
    // *** CORREÇÃO ADICIONADA AQUI ***
    // Se o clique foi em um botão de controle, não faça nada e deixe o evento original do botão funcionar.
    if (e.target.closest('.window-control')) {
        return;
    }

    const win = titleBar.closest('.window');
    if (!win || e.button !== 0) return;
    
    titleBar.style.touchAction = 'none';
    let dragging = false, startX, startY, origX, origY;
    
    // Double-tap detection
    const now = Date.now();
    const lastTap = parseFloat(titleBar.dataset.lastTap || 0);
    if (now - lastTap < 300) {
        // Use o WindowManager para garantir que a lógica de maximizar/restaurar seja a correta
        titleBar.dataset.lastTap = 0;
        if (window.windowManager) window.windowManager.maximizeWindow(win.id);
        return;
    }
    titleBar.dataset.lastTap = now;

    if (e.pointerType === 'mouse' || isWindowLockedForPointerDrag(win)) return;
    if (window.windowManager) window.windowManager.makeActive(win.id);

    // Start dragging logic
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = win.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    
    win.classList.add('dragging');
    try { titleBar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    const onPointerMove = (moveEvent) => {
        if (!dragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        win.style.left = `${origX + dx}px`;
        win.style.top = `${origY + dy}px`;
    };

    const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;
        win.classList.remove('dragging');
        try { titleBar.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        
        // Cleanup listeners
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
}


function handleResizeHandlePointerDown(e, resizeHandle) {
    const win = resizeHandle.closest('.window');
    if (!win || e.button !== 0) return;
    if (e.pointerType === 'mouse' || isWindowLockedForPointerDrag(win)) return;

    resizeHandle.style.touchAction = 'none';
    let resizing = false, startX, startY, origW, origH;

    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = win.getBoundingClientRect();
    origW = rect.width;
    origH = rect.height;
    win.classList.add('resizing');
    try { resizeHandle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    const onPointerMove = (moveEvent) => {
        if (!resizing) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        let newW = origW + dx;
        let newH = origH + dy;
        newW = Math.max(newW, 200);
        newH = Math.max(newH, 150);
        win.style.width = `${newW}px`;
        win.style.height = `${newH}px`;
    };

    const onPointerUp = () => {
        if (!resizing) return;
        resizing = false;
        win.classList.remove('resizing');
        try { resizeHandle.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        
        // Cleanup
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
}
