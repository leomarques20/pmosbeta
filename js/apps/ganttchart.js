import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openGanttChart() {
    const uniqueSuffix = generateId('gantt');
    const winId = window.windowManager.createWindow('Cronograma Gantt', '', { width: '1150px', height: '650px', appType: 'gantt-chart' });
    const content = `
        <div class="app-toolbar gantt-controls">
             ${getStandardAppToolbarHTML()}
             <button id="addGanttTaskBtn_${uniqueSuffix}" class="app-button" style="margin-left: auto;"><i class="fas fa-plus"></i> Nova Tarefa</button>
            <span style="margin-left:15px; font-size:0.9em;">Escala:</span>
            <select id="ganttTimeScale_${uniqueSuffix}" class="app-select" style="width:100px;">
                <option value="days">Dias</option>
                <option value="weeks">Semanas</option>
                <option value="months" selected>Meses</option>
            </select>
            <!-- Zoom controls removed -->
        </div>
        <div class="gantt-main-area">
            <div class="gantt-table-wrapper" id="ganttTableWrapper_${uniqueSuffix}">
                <div class="gantt-table-header"> <span>ID</span><span>Nome</span><span>Início</span><span>Fim</span><span>Dura.</span><span>%</span><span>Recursos</span><span>Deps.</span><span>Cor</span><span>Ações</span> </div>
                <div id="ganttTableBody_${uniqueSuffix}" style="flex-grow:1; overflow-y:auto;"></div>
            </div>
            <!-- Resizer between table and chart -->
            <div class="gantt-resizer" id="ganttResizer_${uniqueSuffix}"></div>
            <div class="gantt-chart-area-wrapper" id="ganttChartAreaWrapper_${uniqueSuffix}">
                <div class="gantt-timeline-header" id="ganttTimelineHeader_${uniqueSuffix}"></div>
                <div id="ganttChartBars_${uniqueSuffix}" style="position:relative;"></div>
            </div>
        </div>`;
    const winData = window.windowManager.windows.get(winId); if(!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;

        const appState = {
        winId, tasks: [], appDataType: 'gantt-chart',
        tableBody: winData.element.querySelector(`#ganttTableBody_${uniqueSuffix}`),
        chartBarsContainer: winData.element.querySelector(`#ganttChartBars_${uniqueSuffix}`),
        timelineHeader: winData.element.querySelector(`#ganttTimelineHeader_${uniqueSuffix}`),
        addTaskBtn: winData.element.querySelector(`#addGanttTaskBtn_${uniqueSuffix}`),
        timeScaleSelect: winData.element.querySelector(`#ganttTimeScale_${uniqueSuffix}`),
        getData: function() { return this.tasks; },
        loadData: function(dataString, fileMeta) { 
            try { 
                const data = JSON.parse(dataString);
                this.tasks = Array.isArray(data) ? data : []; 
                this.fileId = fileMeta.id; 
                this.markClean(); 
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
                this.renderAll(); 
            } catch (e) { 
                showNotification("Erro ao ler arquivo Gantt.", 3000); 
            } 
        },
        init: function() {
            // Configurações padrão da barra de ferramentas e controles
            setupAppToolbarActions(this);
            this.addTaskBtn.onclick = () => this.addTask();
            // Zoom slider removed; automatic scaling is handled in renderChart.
            this.timeScaleSelect.onchange = () => this.renderChart();
            this.tableBody.addEventListener('input', (e) => this.handleTableInput(e));
            // Também captura eventos 'change' para atualizar campos <select> (dependências)
            this.tableBody.addEventListener('change', (e) => this.handleTableInput(e));
            this.tableBody.addEventListener('click', (e) => this.handleTableAction(e));
            // Habilita redimensionamento entre a lista de atividades e o gráfico através do resizer
            const winEl = window.windowManager.windows.get(this.winId).element;
            const resizer = winEl.querySelector('.gantt-resizer');
            const tableWrapper = winEl.querySelector('.gantt-table-wrapper');
            if (resizer && tableWrapper) {
                const self = this;
                resizer.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    const startX = e.clientX;
                    const parentRect = resizer.parentElement.getBoundingClientRect();
                    const startWidth = tableWrapper.getBoundingClientRect().width;
                    const parentWidth = parentRect.width;
                    const onMouseMove = function(event) {
                        const dx = event.clientX - startX;
                        let newWidth = startWidth + dx;
                        const minWidth = parentWidth * 0.2;
                        const maxWidth = parentWidth * 0.8;
                        if (newWidth < minWidth) newWidth = minWidth;
                        if (newWidth > maxWidth) newWidth = maxWidth;
                        const newPercent = (newWidth / parentWidth) * 100;
                        tableWrapper.style.width = newPercent + '%';
                        // Re-renderiza o gráfico para ajustar linhas de dependência
                        self.renderChart();
                    };
                    const onMouseUp = function() {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
            this.renderAll();
        },
        renderAll: function() { this.renderTable(); this.renderChart(); },
        renderTable: function() {
            // Limpa tabela e recria as linhas. Inclui campo de cor e seleção de dependência para cada tarefa.
            this.tableBody.innerHTML = '';
            const tasksSnapshot = [...this.tasks];
            tasksSnapshot.forEach((task) => {
                const row = document.createElement('div');
                row.className = 'gantt-task-table-row';
                row.dataset.taskId = task.id;
                // ID
                const idSpan = document.createElement('span');
                idSpan.textContent = task.id.slice(-4);
                row.appendChild(idSpan);
                // Nome
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.className = 'app-input';
                nameInput.value = task.name;
                nameInput.dataset.field = 'name';
                nameInput.title = task.name;
                row.appendChild(nameInput);
                // Data início
                const startInput = document.createElement('input');
                startInput.type = 'date';
                startInput.className = 'app-input';
                startInput.value = task.start || '';
                startInput.dataset.field = 'start';
                row.appendChild(startInput);
                // Data fim
                const endInput = document.createElement('input');
                endInput.type = 'date';
                endInput.className = 'app-input';
                endInput.value = task.end || '';
                endInput.dataset.field = 'end';
                row.appendChild(endInput);
                // Duração
                const durationInput = document.createElement('input');
                durationInput.type = 'number';
                durationInput.className = 'app-input';
                durationInput.value = task.duration || '';
                durationInput.dataset.field = 'duration';
                durationInput.min = '0';
                durationInput.title = 'Duração (dias)';
                row.appendChild(durationInput);
                // Progresso
                const progressInput = document.createElement('input');
                progressInput.type = 'number';
                progressInput.className = 'app-input';
                progressInput.value = task.progress || 0;
                progressInput.dataset.field = 'progress';
                progressInput.min = '0';
                progressInput.max = '100';
                progressInput.title = '% Concluída';
                row.appendChild(progressInput);
                // Recursos
                const resInput = document.createElement('input');
                resInput.type = 'text';
                resInput.className = 'app-input';
                resInput.value = task.resources || '';
                resInput.dataset.field = 'resources';
                resInput.placeholder = 'Ex: Rec1, Rec2';
                row.appendChild(resInput);
                // Dependências (dropdown)
                const depSelect = document.createElement('select');
                depSelect.className = 'app-select';
                depSelect.dataset.field = 'dependencies';
                // Adiciona opção "Nenhuma"
                const noneOption = document.createElement('option');
                noneOption.value = '';
                noneOption.textContent = 'Nenhuma';
                depSelect.appendChild(noneOption);
                // Para cada outra tarefa, adiciona como opção. Usa cópia das tarefas para evitar modificação durante iteração.
                tasksSnapshot.forEach((otherTask) => {
                    if (otherTask.id === task.id) return;
                    const opt = document.createElement('option');
                    opt.value = otherTask.id;
                    // Rótulo mostra nome e 4 últimos dígitos para identificação
                    opt.textContent = `${otherTask.name} (${otherTask.id.slice(-4)})`;
                    // Se as dependências atuais do task incluem este id, seleciona
                    if (task.dependencies) {
                        const deps = task.dependencies.split(/[,;\s]+/).filter(Boolean);
                        if (deps.includes(otherTask.id)) opt.selected = true;
                    }
                    depSelect.appendChild(opt);
                });
                row.appendChild(depSelect);
                // Cor da tarefa
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = task.color || '#007AFF';
                colorInput.dataset.field = 'color';
                colorInput.title = 'Cor da tarefa';
                row.appendChild(colorInput);
                // Ações (excluir)
                const actionsDiv = document.createElement('div');
                const delBtn = document.createElement('button');
                delBtn.className = 'app-button danger action-button';
                delBtn.dataset.action = 'delete';
                delBtn.title = 'Excluir';
                const delIcon = document.createElement('i');
                delIcon.className = 'fas fa-trash';
                delBtn.appendChild(delIcon);
                actionsDiv.appendChild(delBtn);
                row.appendChild(actionsDiv);
                this.tableBody.appendChild(row);
            });
        },
        renderChart: function() {
            // Limpa áreas de gráfico e cabeçalho
            this.chartBarsContainer.innerHTML = '';
            this.timelineHeader.innerHTML = '';
            // Sem tarefas? nada para renderizar
            if (this.tasks.length === 0) {
                return;
            }
            // Determina as datas mínima e máxima entre todas as tarefas
            let minDateOverall = null;
            let maxDateOverall = null;
            this.tasks.forEach(task => {
                if (task.start) {
                    const startDate = new Date(task.start + "T00:00:00Z");
                    if (!minDateOverall || startDate < minDateOverall) minDateOverall = startDate;
                }
                if (task.end) {
                    const endDate = new Date(task.end + "T00:00:00Z");
                    if (!maxDateOverall || endDate > maxDateOverall) maxDateOverall = endDate;
                }
            });
            if (!minDateOverall || !maxDateOverall || minDateOverall > maxDateOverall) {
                this.chartBarsContainer.innerHTML = '<p style="padding:10px; color:var(--secondary-text-color)">Datas inválidas.</p>';
                return;
            }
            // Escala de tempo
            const timeScale = this.timeScaleSelect.value;
            // Calcula intervalos acolchoados
            const paddedMinDate = new Date(minDateOverall);
            const paddedMaxDate = new Date(maxDateOverall);
            if (timeScale === 'months') {
                paddedMinDate.setUTCDate(paddedMinDate.getUTCDate() - 30);
                paddedMaxDate.setUTCDate(paddedMaxDate.getUTCDate() + 60);
            } else if (timeScale === 'weeks') {
                paddedMinDate.setUTCDate(paddedMinDate.getUTCDate() - 14);
                paddedMaxDate.setUTCDate(paddedMaxDate.getUTCDate() + 28);
            } else {
                paddedMinDate.setUTCDate(paddedMinDate.getUTCDate() - 7);
                paddedMaxDate.setUTCDate(paddedMaxDate.getUTCDate() + 14);
            }
            // Função para dias
            const getDaysBetween = (d1, d2) => Math.ceil(Math.abs(d1 - d2) / (864e5));
            // Calcula quantidade de unidades na linha do tempo (dias, semanas, meses)
            let totalVisualUnits = 0;
            if (timeScale === 'days') {
                totalVisualUnits = getDaysBetween(paddedMinDate, paddedMaxDate) + 1;
            } else if (timeScale === 'weeks') {
                // Ajusta data inicial para domingo (ou segunda dependendo da locale; aqui usa domingo)
                const startOfWeek = new Date(paddedMinDate);
                startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
                const diffDays = getDaysBetween(startOfWeek, paddedMaxDate);
                totalVisualUnits = Math.floor(diffDays / 7) + 1;
            } else {
                const startMonth = new Date(paddedMinDate);
                startMonth.setUTCDate(1);
                const startSeq = startMonth.getUTCFullYear() * 12 + startMonth.getUTCMonth();
                const endSeq = paddedMaxDate.getUTCFullYear() * 12 + paddedMaxDate.getUTCMonth();
                totalVisualUnits = (endSeq - startSeq) + 1;
            }
            // Determina largura disponível e calcula largura por unidade automaticamente.
            const chartWrapper = this.chartBarsContainer.parentElement;
            // Se o contêiner não estiver definido, define um valor padrão
            const availableWidth = chartWrapper ? chartWrapper.clientWidth : 800;
            // Define larguras mínimas para cada escala de tempo para evitar truncamento
            let minimumUnitWidth;
            if (timeScale === 'months') {
                minimumUnitWidth = 80; // meses têm mais caracteres (ex: Jan/24)
            } else if (timeScale === 'weeks') {
                minimumUnitWidth = 60; // semanas necessitam espaço para "Sdd/mm"
            } else {
                minimumUnitWidth = 40; // dias necessitam espaço para "dd/mm"
            }
            let unitVisualWidth = Math.floor(availableWidth / totalVisualUnits);
            if (unitVisualWidth < minimumUnitWidth) {
                unitVisualWidth = minimumUnitWidth;
            }
            // Constrói o cabeçalho da linha do tempo
            let currentTimelineDate;
            let timelineHTML = '';
            if (timeScale === 'days') {
                currentTimelineDate = new Date(paddedMinDate);
                while (currentTimelineDate <= paddedMaxDate) {
                    timelineHTML += `<span style="display:inline-block; width:${unitVisualWidth}px; text-align:center; border-right:1px solid var(--separator-color); font-size:0.8em;">${currentTimelineDate.getUTCDate()}/${currentTimelineDate.getUTCMonth()+1}</span>`;
                    currentTimelineDate.setUTCDate(currentTimelineDate.getUTCDate() + 1);
                }
            } else if (timeScale === 'weeks') {
                currentTimelineDate = new Date(paddedMinDate);
                currentTimelineDate.setUTCDate(currentTimelineDate.getUTCDate() - currentTimelineDate.getUTCDay());
                while (currentTimelineDate <= paddedMaxDate) {
                    const weekEnd = new Date(currentTimelineDate);
                    weekEnd.setUTCDate(currentTimelineDate.getUTCDate() + 6);
                    timelineHTML += `<span style="display:inline-block; width:${unitVisualWidth}px; text-align:center; border-right:1px solid var(--separator-color); font-size:0.8em;" title="Semana de ${currentTimelineDate.toLocaleDateString()} a ${weekEnd.toLocaleDateString()}">S${currentTimelineDate.getUTCDate()}/${currentTimelineDate.getUTCMonth()+1}</span>`;
                    currentTimelineDate.setUTCDate(currentTimelineDate.getUTCDate() + 7);
                }
            } else {
                currentTimelineDate = new Date(paddedMinDate);
                currentTimelineDate.setUTCDate(1);
                while (currentTimelineDate <= paddedMaxDate) {
                    const monthName = currentTimelineDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
                    timelineHTML += `<span style="display:inline-block; width:${unitVisualWidth}px; text-align:center; border-right:1px solid var(--separator-color); font-size:0.8em;">${monthName}</span>`;
                    currentTimelineDate.setUTCMonth(currentTimelineDate.getUTCMonth() + 1);
                }
            }
            this.timelineHeader.innerHTML = timelineHTML;
            this.chartBarsContainer.style.width = `${totalVisualUnits * unitVisualWidth}px`;
            // Cria barras e mapeia informações para as dependências
            const barInfoById = {};
            this.tasks.forEach((task) => {
                const tableRowEl = this.tableBody.querySelector(`.gantt-task-table-row[data-task-id="${task.id}"]`);
                const rowHeight = tableRowEl ? tableRowEl.offsetHeight : 30;
                if (!task.start || !task.end) return;
                const startDate = new Date(task.start + 'T00:00:00Z');
                const endDate = new Date(task.end + 'T00:00:00Z');
                if (startDate > endDate) return;
                let barOffsetUnits;
                let barDurationUnits;
                const effectivePaddedMinDate = new Date(paddedMinDate);
                if (timeScale === 'days') {
                    barOffsetUnits = getDaysBetween(effectivePaddedMinDate, startDate);
                    barDurationUnits = getDaysBetween(startDate, endDate) + 1;
                } else if (timeScale === 'weeks') {
                    effectivePaddedMinDate.setUTCDate(effectivePaddedMinDate.getUTCDate() - effectivePaddedMinDate.getUTCDay());
                    barOffsetUnits = Math.floor(getDaysBetween(effectivePaddedMinDate, startDate) / 7);
                    barDurationUnits = Math.ceil((getDaysBetween(startDate, endDate) + 1) / 7);
                } else {
                    effectivePaddedMinDate.setUTCDate(1);
                    const startMonthSeq = startDate.getUTCFullYear() * 12 + startDate.getUTCMonth();
                    const endMonthSeq = endDate.getUTCFullYear() * 12 + endDate.getUTCMonth();
                    const minMonthSeq = effectivePaddedMinDate.getUTCFullYear() * 12 + effectivePaddedMinDate.getUTCMonth();
                    barOffsetUnits = startMonthSeq - minMonthSeq;
                    barDurationUnits = (endMonthSeq - startMonthSeq) + 1;
                }
                barDurationUnits = Math.max(barDurationUnits, 0.1);
                const barRow = document.createElement('div');
                barRow.className = 'gantt-bar-row';
                barRow.style.height = `${rowHeight}px`;
                barRow.style.lineHeight = `${rowHeight}px`;
                const bar = document.createElement('div');
                bar.className = 'gantt-bar';
                bar.style.backgroundColor = task.color || 'var(--accent-color)';
                const progress = task.progress || 0;
                if (progress >= 100) bar.classList.add('gantt-bar-complete');
                bar.style.left = `${barOffsetUnits * unitVisualWidth}px`;
                bar.style.width = `${barDurationUnits * unitVisualWidth - 2}px`;
                bar.style.top = `calc((${rowHeight}px - 20px) / 2)`;
                bar.title = `${task.name} (${progress}%) - ${new Date(task.start + 'T00:00:00Z').toLocaleDateString()} a ${new Date(task.end + 'T00:00:00Z').toLocaleDateString()}`;
                bar.textContent = `${task.name} (${progress}%)`;
                const progressBarEl = document.createElement('div');
                progressBarEl.className = 'progress';
                progressBarEl.style.width = `${progress}%`;
                bar.appendChild(progressBarEl);
                barRow.appendChild(bar);
                this.chartBarsContainer.appendChild(barRow);
                barInfoById[task.id] = { row: barRow, bar: bar };
            });
            // Geração de linhas de dependência usando SVG
            const svgNS = 'http://www.w3.org/2000/svg';
            if (!this.dependenciesSvg) {
                const svg = document.createElementNS(svgNS, 'svg');
                svg.classList.add('gantt-dependencies-svg');
                svg.style.position = 'absolute';
                svg.style.top = '0';
                svg.style.left = '0';
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.pointerEvents = 'none';
                const defs = document.createElementNS(svgNS, 'defs');
                const marker = document.createElementNS(svgNS, 'marker');
                marker.setAttribute('id', 'ganttArrow');
                marker.setAttribute('viewBox', '0 0 10 10');
                marker.setAttribute('refX', '10');
                marker.setAttribute('refY', '5');
                marker.setAttribute('markerWidth', '10');
                marker.setAttribute('markerHeight', '10');
                marker.setAttribute('orient', 'auto');
                const arrow = document.createElementNS(svgNS, 'path');
                arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                arrow.setAttribute('fill', 'var(--accent-color)');
                marker.appendChild(arrow);
                defs.appendChild(marker);
                svg.appendChild(defs);
                this.dependenciesSvg = svg;
                this.chartBarsContainer.appendChild(svg);
            }
            // Ajusta largura/altura do svg conforme o contêiner de barras
            this.dependenciesSvg.setAttribute('width', this.chartBarsContainer.scrollWidth);
            this.dependenciesSvg.setAttribute('height', this.chartBarsContainer.scrollHeight);
            // Remove linhas antigas mantendo defs
            [...this.dependenciesSvg.querySelectorAll('path.dependency-line')].forEach(el => el.remove());
            // Desenha linhas para cada dependência
            this.tasks.forEach(task => {
                if (!task.dependencies) return;
                const deps = task.dependencies.split(/[,;\s]+/).filter(Boolean);
                deps.forEach(depId => {
                    const parentInfo = barInfoById[depId.trim()];
                    const childInfo = barInfoById[task.id];
                    if (!parentInfo || !childInfo) return;
                    const parentBar = parentInfo.bar;
                    const childBar = childInfo.bar;
                    const parentRow = parentInfo.row;
                    const childRow = childInfo.row;
                    const startX = parentBar.offsetLeft + parentBar.offsetWidth;
                    const startY = parentRow.offsetTop + parentRow.offsetHeight / 2;
                    const offset = 15;
                    const endX = childBar.offsetLeft;
                    const endY = childRow.offsetTop + childRow.offsetHeight / 2;
                    const path = document.createElementNS(svgNS, 'path');
                    path.setAttribute('d', `M ${startX} ${startY} H ${startX + offset} V ${endY} H ${endX}`);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', 'var(--accent-color)');
                    path.setAttribute('stroke-width', '2');
                    path.setAttribute('marker-end', 'url(#ganttArrow)');
                    path.setAttribute('class', 'dependency-line');
                    this.dependenciesSvg.appendChild(path);
                });
            });
        },
        calculateDuration: function(start, end) { if (!start || !end) return null; const startDate = new Date(start + "T00:00:00Z"); const endDate = new Date(end + "T00:00:00Z"); if (endDate < startDate) return null; return Math.ceil(Math.abs(endDate - startDate) / (864e5)) + 1; },
        calculateEndDate: function(start, duration) { if (!start || !duration || duration <= 0) return null; const startDate = new Date(start + "T00:00:00Z"); startDate.setUTCDate(startDate.getUTCDate() + parseInt(duration) -1); return startDate.toISOString().split('T')[0]; },
        handleTableInput: function(e) { const rowEl = e.target.closest('.gantt-task-table-row'); if (!rowEl) return; const taskId = rowEl.dataset.taskId; const task = this.tasks.find(t => t.id === taskId); if (!task) return; const field = e.target.dataset.field; task[field] = e.target.value; if (field === 'start' || field === 'end') { if(task.start && task.end) { task.duration = this.calculateDuration(task.start, task.end); rowEl.querySelector('input[data-field="duration"]').value = task.duration || ''; } } else if (field === 'duration') { if(task.start && task.duration > 0) { task.end = this.calculateEndDate(task.start, task.duration); rowEl.querySelector('input[data-field="end"]').value = task.end || ''; } } this.markDirty(); this.renderChart(); },
        handleTableAction: function(e) { const button = e.target.closest('button[data-action="delete"]'); if (button) { const taskId = button.closest('.gantt-task-table-row').dataset.taskId; this.tasks = this.tasks.filter(t => t.id !== taskId); this.markDirty(); this.renderAll(); } },
        addTask: function() { const defaultColors = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00', '#8E8E93']; const color = defaultColors[this.tasks.length % defaultColors.length]; this.tasks.push({id: generateId('gtsk'), name: 'Nova Tarefa', start: '', end: '', duration: 1, progress: 0, resources: '', dependencies: '', color: color}); this.markDirty(); this.renderAll(); },
        cleanup: () => {}
    };
    
    initializeFileState(appState, "Novo Cronograma", "cronograma.gantt", "gantt-chart");
    winData.currentAppInstance = appState;
    appState.init();
    return winId;
}
