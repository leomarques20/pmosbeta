
const API_URL = 'http://localhost:8000/api/sei/processos';

export async function fetchSeiProcessos(usuario, senha, unidade_alvo = null, filtrar_meus = false) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                usuario,
                senha,
                unidade_alvo,
                filtrar_meus
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao buscar processos do SEI');
        }

        const data = await response.json();
        return data.processos;
    } catch (error) {
        console.error('Erro no serviço SEI:', error);
        throw error;
    }
}
