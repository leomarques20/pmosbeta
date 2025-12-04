import { showNotification } from '../main.js';

/**
 * Opens a modal to generate a memo (memorando) using AI
 * @param {Object} processo - Process information
 * @param {Function} onGenerated - Callback when memo is generated
 */
export function openMemoGenerator(processo, onGenerated) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px);';

    modal.innerHTML = `
        <div style="background: var(--window-bg); padding: 25px; border-radius: 12px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-color); display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-magic" style="color: var(--accent-color);"></i>
                    Gerar Memorando com IA
                </h2>
                <button id="closeMemoModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--secondary-text-color);">×</button>
            </div>
            
            <div style="background: var(--input-bg); padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 3px solid var(--accent-color);">
                <strong style="color: var(--text-color);">Processo:</strong> ${processo.protocolo}
                ${processo.tipo ? `<br><span style="color: var(--secondary-text-color); font-size: 0.9em;">${processo.tipo}</span>` : ''}
            </div>
            
            <form id="memoForm" style="display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-color);">
                        Destinatário: <span style="color: #dc3545;">*</span>
                    </label>
                    <input 
                        type="text" 
                        name="destinatario" 
                        class="app-input" 
                        placeholder="Ex: Coordenador de Recursos Humanos"
                        required
                        style="width: 100%; margin: 0;"
                    >
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-color);">
                        Assunto: <span style="color: #dc3545;">*</span>
                    </label>
                    <input 
                        type="text" 
                        name="assunto" 
                        class="app-input" 
                        placeholder="Ex: Solicitação de renovação de alvará sanitário"
                        required
                        style="width: 100%; margin: 0;"
                    >
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-color);">
                        Unidade remetente:
                    </label>
                    <input 
                        type="text" 
                        name="unidade" 
                        class="app-input" 
                        placeholder="Ex: Diretoria de Administração"
                        value="${processo.unidade || ''}"
                        style="width: 100%; margin: 0;"
                    >
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-color);">
                        Contexto/Instruções adicionais:
                    </label>
                    <textarea 
                        name="contexto" 
                        class="app-textarea" 
                        rows="4" 
                        placeholder="Forneça detalhes sobre o que o memorando deve comunicar..."
                        style="width: 100%; margin: 0; resize: vertical;"
                    >${processo.descricao || ''}</textarea>
                    <small style="color: var(--secondary-text-color); font-size: 0.85em;">
                        Opcional: adicione informações que devem constar no memorando
                    </small>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                    <button type="button" class="app-button secondary" id="cancelMemoBtn">
                        Cancelar
                    </button>
                    <button type="submit" class="app-button primary" style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-magic"></i>
                        Gerar com IA
                    </button>
                </div>
            </form>
            
            <div id="memoResult" style="display: none; margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: var(--text-color); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color: #28a745;"></i>
                        Memorando Gerado
                    </h3>
                    <span id="memoStats" style="color: var(--secondary-text-color); font-size: 0.85em;"></span>
                </div>
                
                <textarea 
                    id="memoText" 
                    class="app-textarea" 
                    rows="18" 
                    style="width: 100%; font-family: 'Courier New', monospace; font-size: 0.9em; line-height: 1.6; margin: 0;"
                ></textarea>
                
                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    <button class="app-button primary" id="copyMemoBtn" style="flex: 1; min-width: 150px;">
                        <i class="fas fa-copy"></i> Copiar Texto
                    </button>
                    <button class="app-button secondary" id="downloadMemoBtn" style="flex: 1; min-width: 150px;">
                        <i class="fas fa-download"></i> Baixar .txt
                    </button>
                    <button class="app-button secondary" id="regenerateMemoBtn" style="flex: 1; min-width: 150px;">
                        <i class="fas fa-redo"></i> Regerar
                    </button>
                </div>
            </div>
            
            <div id="memoLoading" style="display: none; text-align: center; padding: 30px;">
                <div class="spinner" style="border: 4px solid var(--separator-color); border-top: 4px solid var(--accent-color); border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <p style="color: var(--text-color); margin: 0;">Gerando memorando com IA...</p>
                <small style="color: var(--secondary-text-color);">Isso pode levar alguns segundos</small>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);

    const form = modal.querySelector('#memoForm');
    const resultDiv = modal.querySelector('#memoResult');
    const loadingDiv = modal.querySelector('#memoLoading');
    const memoTextArea = modal.querySelector('#memoText');

    // Store form data for regeneration
    let lastFormData = null;

    // Form submission
    form.onsubmit = async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        lastFormData = {
            destinatario: formData.get('destinatario'),
            assunto: formData.get('assunto'),
            unidade: formData.get('unidade'),
            contexto: formData.get('contexto'),
            numeroProcesso: processo.protocolo
        };

        await generateMemo(lastFormData);
    };

    async function generateMemo(data) {
        form.style.display = 'none';
        resultDiv.style.display = 'none';
        loadingDiv.style.display = 'block';

        try {
            const response = await fetch('/.netlify/functions/ai-memo-generator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erro ao gerar memorando');
            }

            memoTextArea.value = result.texto;
            modal.querySelector('#memoStats').textContent =
                `${result.tokens} tokens • Modelo: ${result.modelo}`;

            loadingDiv.style.display = 'none';
            resultDiv.style.display = 'block';

            showNotification('Memorando gerado com sucesso!', 3000);

            if (onGenerated) {
                onGenerated(result.texto);
            }

        } catch (error) {
            console.error('Erro ao gerar memorando:', error);
            loadingDiv.style.display = 'none';
            form.style.display = 'flex';
            showNotification('Erro: ' + error.message, 5000);
        }
    }

    // Copy button
    modal.querySelector('#copyMemoBtn').onclick = () => {
        memoTextArea.select();
        document.execCommand('copy');
        showNotification('Memorando copiado para área de transferência!', 2000);
    };

    // Download button
    modal.querySelector('#downloadMemoBtn').onclick = () => {
        const text = memoTextArea.value;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memorando_${processo.protocolo.replace(/\//g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('Memorando baixado!', 2000);
    };

    // Regenerate button
    modal.querySelector('#regenerateMemoBtn').onclick = () => {
        if (lastFormData) {
            generateMemo(lastFormData);
        }
    };

    // Close buttons
    const closeModal = () => modal.remove();
    modal.querySelector('#closeMemoModal').onclick = closeModal;
    modal.querySelector('#cancelMemoBtn').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}
