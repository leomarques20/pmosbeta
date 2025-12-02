exports.handler = async function (event, context) {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            processos: [],
            message: "Endpoint em desenvolvimento - use credenciais do SEI diretamente por enquanto"
        })
    };
};
