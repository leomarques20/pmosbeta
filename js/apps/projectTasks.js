import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

export function openProjectTasks() {
    const uniqueSuffix = generateId('ptasks');
    const winId = window.windowManager.createWindow('Tarefas de Projeto', '', { width: '1000px', height: '700px', appType: 'project-tasks' });
    const content = `
        <div class="app-toolbar">
            ${getStandardAppToolbarHTML()}
            <button id="trainAiBtn_${uniqueSuffix}" class="app-button" style="margin-left:auto;" title="Treinar IA MapNeural com o feedback fornecido"><i class="fas fa-brain"></i> Treinar IA</button>
        </div>
        <div class="project-tasks-input-area">
            <input type="text" id="taskInput_${uniqueSuffix}" class="app-input" placeholder="Nova tarefa de projeto..." style="flex-grow:2;">
            <input type="text" id="taskResponsibleInput_${uniqueSuffix}" class="app-input" placeholder="Responsável" style="flex-grow:1;">
            <input type="date" id="taskDueDateInput_${uniqueSuffix}" class="app-input" title="Data de Conclusão" style="flex-grow:1;">
            <select id="taskPriorityInput_${uniqueSuffix}" class="app-select" style="flex-grow:1;">
                <option value="baixa">Baixa Prioridade</option> <option value="media" selected>Média Prioridade</option> <option value="alta">Alta Prioridade</option>
            </select>
            <button id="addTaskBtn_${uniqueSuffix}" class="app-button"><i class="fas fa-plus" style="margin-right:5px;"></i> Adicionar</button>
        </div>
        <div class="project-tasks-controls">
            <label for="taskFilterPriority_${uniqueSuffix}" style="font-size:0.9em;">Prioridade:</label>
            <select id="taskFilterPriority_${uniqueSuffix}" class="app-select" style="width: 150px;"> <option value="todas">Todas</option><option value="baixa">Baixa</option> <option value="media">Média</option> <option value="alta">Alta</option> </select>
            <label for="taskFilterResponsible_${uniqueSuffix}" style="font-size:0.9em; margin-left:10px;">Responsável:</label>
            <input type="text" id="taskFilterResponsible_${uniqueSuffix}" class="app-input" style="width:150px; margin-bottom:0;" placeholder="Nome...">
            <label for="taskSortBy_${uniqueSuffix}" style="font-size:0.9em; margin-left:10px;">Ordenar Por:</label>
            <select id="taskSortBy_${uniqueSuffix}" class="app-select" style="width: 170px;"> <option value="dataCriacao">Criação</option> <option value="dataConclusao">Conclusão</option> <option value="prioridade">Prioridade</option> <option value="responsavel">Responsável</option> <option value="aiPriority">Prioridade (IA)</option> </select>
        </div>
        <div class="project-tasks-list-container" id="taskListContainer_${uniqueSuffix}"><ul></ul></div>`;

    const winData = window.windowManager.windows.get(winId); if (!winData) return winId;
    winData.element.querySelector('.window-content').innerHTML = content;

    const appState = {
        winId, tasks: [], editingTaskId: null, appDataType: 'project-tasks',
        taskInput: winData.element.querySelector(`#taskInput_${uniqueSuffix}`),
        responsibleInput: winData.element.querySelector(`#taskResponsibleInput_${uniqueSuffix}`),
        dueDateInput: winData.element.querySelector(`#taskDueDateInput_${uniqueSuffix}`),
        priorityInput: winData.element.querySelector(`#taskPriorityInput_${uniqueSuffix}`),
        addBtn: winData.element.querySelector(`#addTaskBtn_${uniqueSuffix}`),
        listContainerUl: winData.element.querySelector(`#taskListContainer_${uniqueSuffix} ul`),
        filterPrioritySelect: winData.element.querySelector(`#taskFilterPriority_${uniqueSuffix}`),
        filterResponsibleInput: winData.element.querySelector(`#taskFilterResponsible_${uniqueSuffix}`),
        sortBySelect: winData.element.querySelector(`#taskSortBy_${uniqueSuffix}`),
        trainAiBtn: winData.element.querySelector(`#trainAiBtn_${uniqueSuffix}`),

        getData: function() { return this.tasks.map(({ aiPredictedPriority, ...taskToSave }) => taskToSave); },
        loadData: function(dataString, fileMeta) { 
            try { 
                const data = JSON.parse(dataString);
                this.tasks = Array.isArray(data) ? data : []; 
                this.fileId = fileMeta.id; 
                this.markClean(); 
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name); 
                this.renderTasks(); 
            } catch (e) { 
                showNotification("Erro ao ler arquivo de tarefas.", 3000); 
            } 
        },
        renderTaskItem: function(task, parentUl, depth = 0) { const li = document.createElement('li'); li.className = 'task-item' + (task.completed ? ' completed' : ''); li.style.marginLeft = `${depth * 20}px`; const aiPrediction = window.mapNeuralManager.getTaskPriorityPrediction(task); task.aiPredictedPriority = aiPrediction; let aiPriorityDisplay = `<span class="ai-priority-indicator" title="Prioridade Sugerida pela IA MapNeural: ${aiPrediction.toFixed(2)}"><i class="fas fa-brain"></i> IA: ${aiPrediction.toFixed(2)}</span>`; li.innerHTML = `<div class="task-main-info"> <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}"> <div class="task-details"> <span class="task-text">${task.text}</span> <div class="task-meta"> ${task.responsible ? `<span><i class="fas fa-user"></i> ${task.responsible}</span>` : ''} ${task.dueDate ? `<span><i class="fas fa-calendar-alt"></i> ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>` : ''} <span><i class="fas fa-flag"></i> Prioridade: ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span> ${aiPriorityDisplay} </div> </div> <div class="task-actions"> <div class="ai-feedback-buttons"> <button class="app-button secondary action-button" data-action="ai-feedback-important" data-id="${task.id}" title="Marcar como Importante (Treinar IA)"><i class="fas fa-thumbs-up"></i></button> <button class="app-button secondary action-button" data-action="ai-feedback-not-important" data-id="${task.id}" title="Marcar como Menos Importante (Treinar IA)"><i class="fas fa-thumbs-down"></i></button> </div> <button class="app-button secondary action-button" data-action="edit" data-id="${task.id}" title="Editar Tarefa"><i class="fas fa-edit"></i></button> <button class="app-button secondary action-button" data-action="add-subtask" data-id="${task.id}" title="Adicionar Subtarefa"><i class="fas fa-plus"></i></button> <button class="app-button danger action-button" data-action="delete" data-id="${task.id}" title="Excluir Tarefa"><i class="fas fa-trash"></i></button> </div> </div> ${task.subtasks?.length > 0 ? `<div class="subtasks-container" id="subtasksContainer_${task.id}_${uniqueSuffix}"><ul></ul></div>` : ''}`; parentUl.appendChild(li); if (task.subtasks?.length > 0) { const subtasksUl = li.querySelector(`#subtasksContainer_${task.id}_${uniqueSuffix} ul`); task.subtasks.forEach(subtask => this.renderTaskItem(subtask, subtasksUl, depth + 1)); } },
        renderTasks: function() { this.listContainerUl.innerHTML = ''; let filteredTasks = [...this.tasks]; const filterPriority = this.filterPrioritySelect.value; if (filterPriority !== 'todas') { filteredTasks = filteredTasks.filter(t => this.taskMatchesFilter(t, 'priority', filterPriority)); } const filterResponsible = this.filterResponsibleInput.value.toLowerCase(); if (filterResponsible) { filteredTasks = filteredTasks.filter(t => this.taskMatchesFilter(t, 'responsible', filterResponsible)); } const sortBy = this.sortBySelect.value; filteredTasks.sort((a, b) => { if (sortBy === 'dataCriacao') return new Date(a.id.split('_').pop()) - new Date(b.id.split('_').pop()); if (sortBy === 'dataConclusao') { if (!a.dueDate && !b.dueDate) return 0; if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate) - new Date(b.dueDate); } if (sortBy === 'prioridade') { const pOrder = { alta: 1, media: 2, baixa: 3 }; return (pOrder[a.priority] || 4) - (pOrder[b.priority] || 4); } if (sortBy === 'responsavel') return (a.responsible || '').localeCompare(b.responsible || ''); if (sortBy === 'aiPriority') { return (b.aiPredictedPriority ?? -1) - (a.aiPredictedPriority ?? -1); } return 0; }); filteredTasks.forEach(task => this.renderTaskItem(task, this.listContainerUl)); },
        taskMatchesFilter: function(task, field, value) { let match = false; if (field === 'priority' && task.priority === value) match = true; if (field === 'responsible' && task.responsible?.toLowerCase().includes(value)) match = true; if (match) return true; return task.subtasks?.some(st => this.taskMatchesFilter(st, field, value)) ?? false; },
        findTaskById: function(taskId, tasksArray = this.tasks) { for (const task of tasksArray) { if (task.id === taskId) return task; if (task.subtasks) { const foundInSubtask = this.findTaskById(taskId, task.subtasks); if (foundInSubtask) return foundInSubtask; } } return null; },
        deleteTaskRecursive: function(taskId, tasksArray = this.tasks) { for (let i = 0; i < tasksArray.length; i++) { if (tasksArray[i].id === taskId) { tasksArray.splice(i, 1); return true; } if (tasksArray[i].subtasks && this.deleteTaskRecursive(taskId, tasksArray[i].subtasks)) return true; } return false; },
        cleanup: () => {}
    };
    initializeFileState(appState, "Nova Lista de Tarefas", "projeto_tarefas.tasks", "project-tasks"); 
    winData.currentAppInstance = appState;
    setupAppToolbarActions(appState);
    appState.addBtn.onclick = () => { const text = appState.taskInput.value.trim(); if (!text) { showNotification("A descrição da tarefa não pode estar vazia.", 2000); return; } const newTaskData = { text: text, responsible: appState.responsibleInput.value.trim(), dueDate: appState.dueDateInput.value || null, priority: appState.priorityInput.value, completed: false, subtasks: [] }; if (appState.editingTaskId) { const taskToUpdate = appState.findTaskById(appState.editingTaskId); if (taskToUpdate) Object.assign(taskToUpdate, { ...newTaskData, id: appState.editingTaskId, subtasks: taskToUpdate.subtasks }); appState.editingTaskId = null; appState.addBtn.innerHTML = '<i class="fas fa-plus" style="margin-right:5px;"></i> Adicionar'; } else { newTaskData.id = generateId('task'); appState.tasks.push(newTaskData); } appState.taskInput.value = ''; appState.responsibleInput.value = ''; appState.dueDateInput.value = ''; appState.priorityInput.value = 'media'; appState.markDirty(); appState.renderTasks(); };
    [appState.filterPrioritySelect, appState.filterResponsibleInput, appState.sortBySelect].forEach(el => el.oninput = () => appState.renderTasks());
    appState.listContainerUl.addEventListener('click', (e) => { const targetButton = e.target.closest('button'); const targetCheckbox = e.target.closest('.task-checkbox'); let hasChanged = false; if (targetCheckbox) { const taskId = targetCheckbox.dataset.id; const task = appState.findTaskById(taskId); if (task) task.completed = targetCheckbox.checked; hasChanged = true; } else if (targetButton) { const action = targetButton.dataset.action; const taskId = targetButton.dataset.id; const task = appState.findTaskById(taskId); if (action === 'delete') { if (confirm("Tem certeza que deseja excluir esta tarefa e suas subtarefas?")) { appState.deleteTaskRecursive(taskId); hasChanged = true; } } else if (action === 'add-subtask' && task) { const subtaskText = prompt("Descrição da nova subtarefa:"); if (subtaskText) { if (!task.subtasks) task.subtasks = []; task.subtasks.push({ id: generateId('subtask'), text: subtaskText, responsible: task.responsible, dueDate: task.dueDate, priority: task.priority, completed: false, subtasks: [] }); hasChanged = true; } } else if (action === 'edit' && task) { appState.taskInput.value = task.text; appState.responsibleInput.value = task.responsible || ''; appState.dueDateInput.value = task.dueDate || ''; appState.priorityInput.value = task.priority || 'media'; appState.addBtn.innerHTML = '<i class="fas fa-save" style="margin-right:5px;"></i> Atualizar'; appState.editingTaskId = taskId; } else if (action === 'ai-feedback-important' && task) { window.mapNeuralManager.addTrainingSample(task, 0.9); showNotification(`Feedback "Importante" registrado.`, 2000); } else if (action === 'ai-feedback-not-important' && task) { window.mapNeuralManager.addTrainingSample(task, 0.1); showNotification(`Feedback "Menos Importante" registrado.`, 2000); } } if(hasChanged) { appState.markDirty(); appState.renderTasks(); } });
    appState.trainAiBtn.onclick = () => { window.mapNeuralManager.trainNetwork(); showNotification("IA MapNeural treinada!", 2500); appState.renderTasks(); };
    appState.renderTasks();
    return winId;
}