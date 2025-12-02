const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const { URLSearchParams, URL } = require('url');

const SEI_BASE_URL = 'https://www.sei.mg.gov.br/sei';
const SEI_LOGIN_URL = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI';

function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;

    // Se for array (set-cookie), junta
    const list = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];

    list.forEach(c => {
        // Pode vir múltiplos cookies numa string separados por vírgula ou ponto-e-vírgula
        // Mas set-cookie geralmente é um por linha/item do array
        const parts = c.split(';')[0].split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            cookies[key] = val;
        }
    });
    return cookies;
}

function stringifyCookies(cookies) {
    return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

function makeRequest(url, options = {}, redirectChain = []) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        redirectChain.push(url);

        const req = protocol.request(url, options, (res) => {
            // Seguir redirecionamento
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();

                // Prepara novas opções
                const newOptions = { ...options, method: 'GET' };
                delete newOptions.body;

                // Remove headers de POST
                if (newOptions.headers) {
                    delete newOptions.headers['Content-Type'];
                    delete newOptions.headers['Content-Length'];
                    delete newOptions.headers['Origin'];
                    // Referer deve ser a URL anterior
                    newOptions.headers['Referer'] = url;
                }

                // Atualiza cookies
                if (res.headers['set-cookie']) {
                    const currentCookies = parseCookies(newOptions.headers['Cookie']);
                    const newCookies = parseCookies(res.headers['set-cookie']);
                    const mergedCookies = { ...currentCookies, ...newCookies };
                    newOptions.headers['Cookie'] = stringifyCookies(mergedCookies);
                }

                makeRequest(redirectUrl, newOptions, redirectChain).then(resolve).catch(reject);
                return;
            }

            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    data,
                    headers: res.headers,
                    statusCode: res.statusCode,
                    finalUrl: url,
                    redirectChain
                });
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

        let finalResponse = loginResponse;

        // Se o loginResponse não tiver tabela de processos, tenta acessar a URL final ou a padrão
        if (!loginResponse.data.includes('infraTable')) {
            let targetUrl = loginResponse.finalUrl;

            // Se a URL final for a de login (falha ou não redirecionou), força a de controle
            if (targetUrl.includes('login.php')) {
                targetUrl = `${SEI_BASE_URL}/controlador.php?acao=procedimento_controlar&acao_origem=procedimento_controlar&acao_retorno=procedimento_controlar&id_procedimento_atual=&id_documento_atual=&infra_sistema=100000100`;
            }

            finalResponse = await makeRequest(targetUrl, {
                method: 'GET',
                headers: {
                    'Cookie': newCookieString,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': SEI_LOGIN_URL,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });
        }

        // Parse HTML para extrair processos
        const $ = cheerio.load(finalResponse.data);
        const processos = [];

        // Debug: verifica se logou com sucesso
        const hasLoginForm = finalResponse.data.includes('txtUsuario') || finalResponse.data.includes('pwdSenha');
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
                    htmlSnippet: finalResponse.data ? finalResponse.data.substring(0, 500) : "EMPTY RESPONSE",
                    statusCode: finalResponse.statusCode,
                    finalUrl: finalResponse.finalUrl,
                    redirectChain: finalResponse.redirectChain
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
