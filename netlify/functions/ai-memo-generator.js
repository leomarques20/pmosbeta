const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (e) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ success: false, error: 'Corpo da requisição inválido.' })
        };
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    try {
        const { destinatario, assunto, contexto, numeroProcesso, unidade } = payload || {};

        // Validação
        if (!destinatario || !assunto) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Destinatário e assunto são obrigatórios'
                })
            };
        }

        // Inicializa Gemini AI
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'API key não configurada. Configure GEMINI_API_KEY nas variáveis de ambiente.'
                })
            };
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        // Prompt otimizado para memorandos oficiais
        const prompt = `Você é um assistente especializado em redigir memorandos oficiais para órgãos públicos brasileiros.

TAREFA: Criar um memorando formal e objetivo

INFORMAÇÕES:
- Destinatário: ${destinatario}
- Assunto: ${assunto}
- Processo SEI: ${numeroProcesso || 'Não informado'}
- Unidade: ${unidade || 'Não informada'}
- Contexto adicional: ${contexto || 'Não fornecido'}

INSTRUÇÕES:
1. Use linguagem formal, clara e objetiva
2. Estrutura completa: cabeçalho, saudação, corpo (introdução, desenvolvimento, conclusão), despedida
3. Máximo 350 palavras
4. Use apenas informações fornecidas, não invente dados
5. Se o processo SEI for mencionado, inclua-o no contexto
6. Mantenha tom respeitoso e profissional
7. Formato de memorando oficial brasileiro

FORMATO ESPERADO:

MEMORANDO Nº ___/${new Date().getFullYear()}-[SIGLA DA UNIDADE]

De: [Unidade remetente]
Para: ${destinatario}
Assunto: ${assunto}

[Cidade], [data por extenso]

${destinatario},

[Corpo do memorando com parágrafos bem estruturados]

Atenciosamente,

[Espaço para assinatura]
[Nome do servidor]
[Cargo]

Gere APENAS o texto do memorando, sem comentários ou explicações adicionais:`;

        console.log('Gerando memorando com Gemini...');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const texto = response.text();

        console.log(`Memorando gerado com sucesso. Tamanho: ${texto.length} caracteres`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                texto: texto,
                modelo: modelName,
                tokens: Math.ceil(texto.length / 4), // Estimativa
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Erro ao gerar memorando:', error && error.message);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Erro ao gerar memorando com a IA. Tente novamente.'
            })
        };
    }
};
