const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const { URLSearchParams } = require('url');

const SEI_BASE_URL = 'https://www.sei.mg.gov.br/sei';
const SEI_LOGIN_URL = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({ data, headers: res.headers, statusCode: res.statusCode });
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { usuario, senha, orgao, captcha, cookies } = JSON.parse(event.body);

        // Monta cookies string
        const cookieString = Object.entries(cookies || {})
            .map(([key, val]) => `${key}=${val}`)
            .join('; ');

        // Dados do formulário de login
        const formData = new URLSearchParams({
            txtUsuario: usuario,
            pwdSenha: senha,
            selOrgao: orgao || '0',
            hdnIdSistema: '100000100',
            hdnIdOrgao: orgao || '0',
            sbmLogin: 'Acessar'
        });


        if (captcha) {
            formData.append('txtCaptcha', captcha);
        }

        // Faz login no SIP
        const loginResponse = await makeRequest(SEI_LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: formData.toString()
        });

        // Extrai cookies do login
        const newCookies = {};
        const setCookieHeaders = loginResponse.headers['set-cookie'] || [];
        setCookieHeaders.forEach(cookie => {
            const parts = cookie.split(';')[0].split('=');
            if (parts.length === 2) {
                newCookies[parts[0]] = parts[1];
            }
        });

        // Combina cookies antigos e novos
        const allCookies = { ...cookies, ...newCookies };
        const newCookieString = Object.entries(allCookies)
            .map(([key, val]) => `${key}=${val}`)
            .join('; ');

        // Agora acessa a página de controle de processos no SEI
        const processosResponse = await makeRequest(`${SEI_BASE_URL}/controlador.php?acao=procedimento_controlar&acao_origem=procedimento_controlar&acao_retorno=procedimento_controlar&id_procedimento_atual=&id_documento_atual=&infra_sistema=100000100`, {
            method: 'GET',
            headers: {
                'Cookie': newCookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Parse HTML para extrair processos
        const $ = cheerio.load(processosResponse.data);
        const processos = [];

        // Debug: verifica se logou com sucesso
        const hasLoginForm = processosResponse.data.includes('txtUsuario') || processosResponse.data.includes('pwdSenha');
        const hasErrorMessage = $('.infraMensagemAlerta, .infraMensagemErro').text();

        // Procura tabelas de processos
        $('table.infraTable tr').each((i, row) => {
            const $row = $(row);
            const $link = $row.find('a.infraLinkProcesso');

            if ($link.length > 0) {
                const protocolo = $link.text().trim();
                const href = $link.attr('href');
                const $cols = $row.find('td');

                if ($cols.length >= 3) {
                    const interessados = $cols.eq(2).text().trim();
                    const atribuido = $cols.length > 4 ? $cols.eq($cols.length - 2).text().trim() : '';

                    processos.push({
                        protocolo,
                        link_sei: href ? `${SEI_BASE_URL}/${href}` : '',
                        interessados,
                        atribuido_a: atribuido,
                        unidade: 'Padrão'
                    });
                }
            }
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                processos,
                total: processos.length,
                debug: {
                    loginFailed: hasLoginForm,
                    errorMessage: hasErrorMessage,
                    tablesFound: $('table.infraTable').length,
                    rowsFound: $('table.infraTable tr').length,
                    linksFound: $('a.infraLinkProcesso').length,
                    htmlSnippet: processosResponse.data.substring(0, 500) // Primeiros 500 caracteres
                }
            })
        };

    } catch (error) {
        console.error('Erro:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: error.message,
                processos: []
            })
        };
    }
};
