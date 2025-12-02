const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const { URLSearchParams, URL } = require('url');

const SEI_BASE_URL = 'https://www.sei.mg.gov.br/sei';
const SEI_LOGIN_URL = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.request(url, options, (res) => {
            // Seguir redirecionamento
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                // Preserva cookies no redirecionamento
                const newOptions = { ...options, method: 'GET' }; // Redirecionamentos geralmente viram GET
                delete newOptions.body; // Remove corpo no redirecionamento

                // Atualiza cookies se houver
                if (res.headers['set-cookie']) {
                    const currentCookies = newOptions.headers['Cookie'] || '';
                    const newCookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
                    newOptions.headers['Cookie'] = currentCookies ? `${currentCookies}; ${newCookies}` : newCookies;
                }

                makeRequest(redirectUrl, newOptions).then(resolve).catch(reject);
                return;
            }

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

        // 1. Acessa a página de login para pegar cookies iniciais e campos ocultos
        const loginPageResponse = await makeRequest(SEI_LOGIN_URL, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Extrai cookies da página de login
        const initialCookies = {};
        (loginPageResponse.headers['set-cookie'] || []).forEach(cookie => {
            const parts = cookie.split(';')[0].split('=');
            if (parts.length === 2) initialCookies[parts[0]] = parts[1];
        });

        // Combina com cookies do cliente (priorizando os novos do servidor)
        const cookiesToUse = { ...cookies, ...initialCookies };
        const cookieString = Object.entries(cookiesToUse).map(([k, v]) => `${k}=${v}`).join('; ');

        // Extrai campos ocultos do formulário
        const $login = cheerio.load(loginPageResponse.data);
        const hiddenFields = {};
        $login('input[type="hidden"]').each((i, el) => {
            const name = $login(el).attr('name');
            const value = $login(el).attr('value');
            if (name) hiddenFields[name] = value || '';
        });

        // Monta dados do formulário preservando campos ocultos originais
        const formData = new URLSearchParams();

        // Adiciona campos ocultos raspados
        Object.entries(hiddenFields).forEach(([key, value]) => {
            formData.append(key, value);
        });

        // Sobrescreve/Adiciona credenciais
        formData.set('txtUsuario', usuario);
        formData.set('pwdSenha', senha);
        formData.set('selOrgao', orgao || '0');

        // Garante que sbmLogin exista (às vezes é input submit, não hidden)
        if (!formData.has('sbmLogin')) {
            formData.set('sbmLogin', 'Acessar');
        }

        if (captcha) {
            formData.set('txtCaptcha', captcha);
        }

        // 2. Faz o POST de login
        const loginResponse = await makeRequest(SEI_LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://www.sei.mg.gov.br',
                'Referer': SEI_LOGIN_URL,
                'Upgrade-Insecure-Requests': '1'
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
        const allCookies = { ...cookiesToUse, ...newCookies };
        const newCookieString = Object.entries(allCookies)
            .map(([key, val]) => `${key}=${val}`)
            .join('; ');

        // Agora acessa a página de controle de processos no SEI
        const processosResponse = await makeRequest(`${SEI_BASE_URL}/controlador.php?acao=procedimento_controlar&acao_origem=procedimento_controlar&acao_retorno=procedimento_controlar&id_procedimento_atual=&id_documento_atual=&infra_sistema=100000100`, {
            method: 'GET',
            headers: {
                'Cookie': newCookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': SEI_LOGIN_URL,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
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
                    htmlSnippet: processosResponse.data ? processosResponse.data.substring(0, 500) : "EMPTY RESPONSE",
                    statusCode: processosResponse.statusCode,
                    responseHeaders: processosResponse.headers
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
