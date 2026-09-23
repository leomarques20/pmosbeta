
// Usa o endpoint relativo: no Netlify, /api/sei/processos é redirecionado para a
// função netlify/functions/sei-processos.js (ver netlify.toml). Em desenvolvimento
// com o backend Python opcional, rode-o atrás do mesmo host ou ajuste esta URL.
const API_URL = '/api/sei/processos';

export async function fetchSeiProcessos(usuario, senha, unidade_alvo = null, filtrar_meus = false, extras = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...extras, // ex.: { orgao, captcha, cookies, hidden_fields, login_url }
                usuario,
                senha,
                unidade_alvo,
                filtrar_meus
            }),
        });

        let data = null;
        try { data = await response.json(); } catch (_) { data = null; }

        if (!response.ok) {
            throw new Error((data && (data.error || data.detail)) || 'Erro ao buscar processos do SEI');
        }

        return (data && Array.isArray(data.processos)) ? data.processos : [];
    } catch (error) {
        console.error('Erro no serviço SEI:', error);
        throw error;
    }
}
