(function(){
    const SNAP_THRESHOLD = 40; const SNAP_ANIM = 'all 0.18s cubic-bezier(.34,1.56,.64,1)'; const MIN_DRAG_DISTANCE = 5;
    let draggingWin = null; let startX = 0; let startY = 0;
    document.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const win = e.target.closest('.window'); if (!win) return; const titleBar = e.target.closest('.title-bar'); if (!titleBar || e.target.closest('.window-control')) return; if (win.classList.contains('maximized')) return; if (window.windowManager && window.windowManager.stageManager && window.windowManager.stageManager.isActive) return; draggingWin = win; startX = e.clientX; startY = e.clientY; win.dataset.dragging = '1'; });
    document.addEventListener('mouseup', (e) => {
        if (!draggingWin) return;
        const win = draggingWin; draggingWin = null; delete win.dataset.dragging;
        // Só encaixa se a janela realmente foi arrastada (um simples clique na barra de título não deve redimensioná-la)
        if (Math.abs(e.clientX - startX) < MIN_DRAG_DISTANCE && Math.abs(e.clientY - startY) < MIN_DRAG_DISTANCE) return;
        if (!win.isConnected || win.classList.contains('maximized')) return;
        const rect = win.getBoundingClientRect(); const W = window.innerWidth; const H = window.innerHeight - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-height')) || 48);
        function near(val, edge) { return Math.abs(val - edge) <= SNAP_THRESHOLD; }
        let snap = null;
        // Cantos primeiro (antes eram inalcançáveis, pois as bordas eram testadas antes)
        if (near(rect.left,0) && near(rect.top,0)) snap = {left:0, top:0, width:W/2, height:H/2};
        else if (near(rect.right,W) && near(rect.top,0)) snap = {left:W/2, top:0, width:W/2, height:H/2};
        else if (near(rect.left,0) && near(rect.bottom,H)) snap = {left:0, top:H/2, width:W/2, height:H/2};
        else if (near(rect.right,W) && near(rect.bottom,H)) snap = {left:W/2, top:H/2, width:W/2, height:H/2};
        else if (near(rect.top, 0) && rect.left > SNAP_THRESHOLD && rect.right < W - SNAP_THRESHOLD) snap = {left: 0, top: 0, width: W, height: H};
        else if (near(rect.left, 0)) snap = {left:0, top:0, width: W/2, height:H};
        else if (near(rect.right, W)) snap = {left:W/2, top:0, width: W/2, height:H};
        else if (near(rect.bottom, H)) snap = {left:0, top:H/2, width:W, height:H/2};
        if (snap) { win.style.transition = SNAP_ANIM; Object.assign(win.style, { left: snap.left + 'px', top: snap.top + 'px', width: snap.width + 'px', height: snap.height + 'px' }); setTimeout(() => (win.style.transition = ''), 200); }
    });
})();
