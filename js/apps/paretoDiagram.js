import { generateId, showNotification } from '../main.js';
import { getStandardAppToolbarHTML, initializeFileState, setupAppToolbarActions } from './app.js';

/**
 * Aplicativo Pareto – Diagrama de Pareto para análise de causas / categorias.
 */
export function openParetoDiagram() {
    const uniqueSuffix = generateId('pareto');
    const winId = window.windowManager.createWindow('Diagrama de Pareto', { width: '1100px', height: '720px', appType: 'pareto-diagram' });
    const winData = window.windowManager.windows.get(winId);
    if (!winData) return winId;

    const content = `
        <div class="app-toolbar">
            ${getStandardAppToolbarHTML()}
        </div>
        <div class="pareto-layout">
            <div class="pareto-form-panel">
                <h4><i class="fas fa-list"></i> Dados do Diagrama de Pareto</h4>
                <div class="pareto-form-grid">
                    <input type="text"
                        id="paretoCategory_${uniqueSuffix}"
                        class="app-input"
                        placeholder="Categoria / causa (ex.: tipo de problema, motivo, etapa do processo)">
                    <input type="number"
                        id="paretoValue_${uniqueSuffix}"
                        class="app-input"
                        min="0"
                        step="0.01"
                        placeholder="Valor (frequência, custo, tempo, etc.)">
                    <button id="paretoAdd_${uniqueSuffix}" class="app-button">
                        <i class="fas fa-plus"></i> Adicionar
                    </button>
                </div>
                <div class="pareto-options-row">
                    <label class="pareto-option">
                        <span>Tipo de valor:</span>
                        <select id="paretoValueType_${uniqueSuffix}" class="app-select">
                            <option value="frequencia">Frequência (número de ocorrências)</option>
                            <option value="impacto">Impacto (tempo, custo, volume, etc.)</option>
                        </select>
                    </label>
                    <label class="pareto-option">
                        <input type="checkbox" id="paretoKeepOriginalOrder_${uniqueSuffix}">
                        <span>Manter ordem original (não reordenar por valor)</span>
                    </label>
                </div>
                <div class="pareto-table-wrapper">
                    <table class="pareto-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Categoria</th>
                                <th>Valor</th>
                                <th>% do total</th>
                                <th>% acumulado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="paretoTableBody_${uniqueSuffix}">
                            <!-- linhas geradas dinamicamente -->
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2">Total</td>
                                <td id="paretoTotalValue_${uniqueSuffix}">0</td>
                                <td colspan="2" id="paretoTotalPercent_${uniqueSuffix}">100%</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            <div class="pareto-chart-panel">
                <h4><i class="fas fa-chart-line"></i> Gráfico de Pareto</h4>
                <canvas id="paretoChart_${uniqueSuffix}" height="260"></canvas>
                <p class="pareto-hint">
                    Dica: foque nas poucas categorias que concentram a maior parte do impacto (regra 80/20).
                </p>
            </div>
        </div>
    `;

    winData.element.querySelector('.window-content').innerHTML = content;

    const appState = {
        winId,
        appDataType: 'pareto-diagram',
        items: [],
        chartInstance: null,

        categoryInput: winData.element.querySelector(`#paretoCategory_${uniqueSuffix}`),
        valueInput: winData.element.querySelector(`#paretoValue_${uniqueSuffix}`),
        valueTypeSelect: winData.element.querySelector(`#paretoValueType_${uniqueSuffix}`),
        keepOriginalOrderCheckbox: winData.element.querySelector(`#paretoKeepOriginalOrder_${uniqueSuffix}`),
        addButton: winData.element.querySelector(`#paretoAdd_${uniqueSuffix}`),
        tableBody: winData.element.querySelector(`#paretoTableBody_${uniqueSuffix}`),
        totalValueCell: winData.element.querySelector(`#paretoTotalValue_${uniqueSuffix}`),
        totalPercentCell: winData.element.querySelector(`#paretoTotalPercent_${uniqueSuffix}`),
        chartCanvas: winData.element.querySelector(`#paretoChart_${uniqueSuffix}`),

        getData: function() {
            return {
                items: this.items,
                valueType: this.valueTypeSelect.value,
                keepOriginalOrder: this.keepOriginalOrderCheckbox.checked
            };
        },

        loadData: function(dataString, fileMeta) {
            try {
                const data = JSON.parse(dataString);
                this.items = Array.isArray(data.items) ? data.items : [];
                if (data.valueType && this.valueTypeSelect) {
                    this.valueTypeSelect.value = data.valueType;
                }
                if (typeof data.keepOriginalOrder === 'boolean') {
                    this.keepOriginalOrderCheckbox.checked = data.keepOriginalOrder;
                }
                this.fileId = fileMeta.id;
                this.markClean();
                window.windowManager.updateWindowTitle(this.winId, fileMeta.name);
                this.renderTableAndChart();
            } catch (e) {
                console.error(e);
                showNotification("Erro ao ler arquivo do Diagrama de Pareto.", 3000);
            }
        },

        renderTableAndChart: function() {
            // Ordenar (quando configurado) e calcular acumulado
            let itemsForDisplay = [...this.items];
            if (!this.keepOriginalOrderCheckbox.checked) {
                itemsForDisplay.sort((a, b) => (b.value || 0) - (a.value || 0));
            }

            const total = itemsForDisplay.reduce((sum, it) => sum + (Number(it.value) || 0), 0);
            let running = 0;

            this.tableBody.innerHTML = '';
            const labels = [];
            const values = [];
            const cumulativePercents = [];

            itemsForDisplay.forEach((item, index) => {
                const value = Number(item.value) || 0;
                running += value;
                const percent = total > 0 ? (value / total) * 100 : 0;
                const cumulative = total > 0 ? (running / total) * 100 : 0;

                labels.push(item.category || `Item ${index + 1}`);
                values.push(value);
                cumulativePercents.push(cumulative);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${item.category || ''}</td>
                    <td>${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                    <td>${percent.toFixed(1)}%</td>
                    <td>${cumulative.toFixed(1)}%</td>
                    <td>
                        <button class="action-button" data-action="edit" data-index="${index}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-button danger" data-action="delete" data-index="${index}" title="Excluir">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
                this.tableBody.appendChild(tr);
            });

            this.totalValueCell.textContent = total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            this.totalPercentCell.textContent = total > 0 ? '100%' : '0%';

            this.updateChart(itemsForDisplay, labels, values, cumulativePercents);
            this.markDirty();
        },

        updateChart: function(itemsForDisplay, labels, values, cumulativePercents) {
            if (!(window.Chart && this.chartCanvas)) {
                return;
            }

            const ctx = this.chartCanvas.getContext('2d');
            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            this.chartInstance = new window.Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            type: 'bar',
                            label: 'Valor',
                            data: values,
                            yAxisID: 'y',
                        },
                        {
                            type: 'line',
                            label: '% acumulado',
                            data: cumulativePercents,
                            yAxisID: 'y1',
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    if (ctx.datasetIndex === 0) {
                                        return `Valor: ${ctx.parsed.y.toLocaleString('pt-BR')}`;
                                    }
                                    return `% acumulado: ${ctx.parsed.y.toFixed(1)}%`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: this.valueTypeSelect.value === 'frequencia' ? 'Frequência' : 'Impacto'
                            }
                        },
                        y1: {
                            beginAtZero: true,
                            position: 'right',
                            min: 0,
                            max: 100,
                            ticks: {
                                callback: (v) => v + '%'
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });
        },

        addItemFromForm: function() {
            const category = (this.categoryInput.value || '').trim();
            const value = Number(this.valueInput.value);
            if (!category) {
                showNotification("Informe uma categoria / causa.", 2500);
                this.categoryInput.focus();
                return;
            }
            if (isNaN(value) || value <= 0) {
                showNotification("Informe um valor numérico maior que zero.", 2500);
                this.valueInput.focus();
                return;
            }
            this.items.push({
                id: generateId('pareto_item'),
                category,
                value,
            });
            this.categoryInput.value = '';
            this.valueInput.value = '';
            this.renderTableAndChart();
        },

        editItemAtIndex: function(index) {
            const item = this.items[index];
            if (!item) return;
            this.categoryInput.value = item.category || '';
            this.valueInput.value = item.value != null ? String(item.value) : '';
            // Remover temporariamente para evitar duplicação
            this.items.splice(index, 1);
            this.renderTableAndChart();
        },

        deleteItemAtIndex: function(index) {
            const item = this.items[index];
            if (!item) return;
            if (!confirm(`Deseja remover a categoria "${item.category}" do diagrama?`)) return;
            this.items.splice(index, 1);
            this.renderTableAndChart();
        },

        cleanup: function() {
            if (this.chartInstance) {
                this.chartInstance.destroy();
                this.chartInstance = null;
            }
        }
    };

    initializeFileState(appState, "Novo Diagrama de Pareto", "diagrama_pareto.pareto", "pareto-diagram");
    winData.currentAppInstance = appState;
    setupAppToolbarActions(appState);

    // Listeners de UI
    appState.addButton.addEventListener('click', () => appState.addItemFromForm());
    appState.valueInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            appState.addItemFromForm();
        }
    });
    appState.categoryInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            appState.valueInput.focus();
        }
    });
    appState.valueTypeSelect.addEventListener('change', () => appState.renderTableAndChart());
    appState.keepOriginalOrderCheckbox.addEventListener('change', () => appState.renderTableAndChart());

    appState.tableBody.addEventListener('click', (ev) => {
        const button = ev.target.closest('button.action-button');
        if (!button) return;
        const index = Number(button.dataset.index);
        const action = button.dataset.action;
        if (action === 'edit') {
            appState.editItemAtIndex(index);
        } else if (action === 'delete') {
            appState.deleteItemAtIndex(index);
        }
    });

    return winId;
}
