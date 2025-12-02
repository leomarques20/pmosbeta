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

const iconv = require('iconv-lite');

function makeRequest(url, options = {}, redirectChain = [], cookieJar = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        redirectChain.push(url);

        // Merge cookies from options into cookieJar if provided
        if (options.headers && options.headers['Cookie']) {
            const initialCookies = parseCookies(options.headers['Cookie']);
            Object.assign(cookieJar, initialCookies);
        }

        const req = protocol.request(url, options, (res) => {
            // Capture cookies from this response
            if (res.headers['set-cookie']) {
                const newCookies = parseCookies(res.headers['set-cookie']);
                Object.assign(cookieJar, newCookies);
            }

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
                    newOptions.headers['Referer'] = url;
                    // Update Cookie header with accumulated cookies
                    newOptions.headers['Cookie'] = stringifyCookies(cookieJar);
                }

                makeRequest(redirectUrl, newOptions, redirectChain, cookieJar).then(resolve).catch(reject);
                return;
            }

            const chunks = [];

            res.on('data', (chunk) => {
                chunks.push(chunk);
            });

            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                // Tenta detectar encoding ou usa latin1 (win1252 é superset seguro de iso-8859-1)
                const contentType = res.headers['content-type'] || '';
                let encoding = 'win1252'; // Default para SEI
                if (contentType.includes('utf-8')) encoding = 'utf8';

                const data = iconv.decode(buffer, encoding);

                resolve({
                    data,
                    headers: res.headers,
                    statusCode: res.statusCode,
                    finalUrl: url,
                    redirectChain,
                    cookieJar // Return the accumulated cookies
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

// Helper para URL-encode em ISO-8859-1
function urlEncodeISO(str) {
    if (!str) return '';
    const buffer = iconv.encode(str, 'win1252');
    let res = '';
    for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        // Caracteres seguros não precisam de escape
        if (
            (byte >= 0x30 && byte <= 0x39) || // 0-9
            (byte >= 0x41 && byte <= 0x5a) || // A-Z
            (byte >= 0x61 && byte <= 0x7a) || // a-z
            byte === 0x2d || byte === 0x5f || byte === 0x2e || byte === 0x7e // - _ . ~
        ) {
            res += String.fromCharCode(byte);
        } else if (byte === 0x20) {
            res += '+';
        } else {
            res += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
        }
    }
    return res;
}

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { usuario, senha, orgao, captcha, cookies, hidden_fields, login_url } = JSON.parse(event.body);

        // Combina com cookies do cliente
        const cookiesToUse = { ...cookies };
        const cookieString = stringifyCookies(cookiesToUse);

        // Usa os campos ocultos fornecidos, ou valores padrão conhecidos do SEI
        // Os campos hdnAcao e hdnInfraPrefixoCookie são adicionados por JavaScript no cliente
        // então podem não vir no hidden_fields
        const hiddenFields = hidden_fields || {};

        // Adiciona valores padrão se não vieram
        if (!hiddenFields['hdnAcao']) {
            hiddenFields['hdnAcao'] = '1';  // Valor padrão observado
        }
        if (!hiddenFields['hdnInfraPrefixoCookie']) {
            hiddenFields['hdnInfraPrefixoCookie'] = 'Sistema_Eletrônico_de_Informações';  // Valor padrão observado
        }

        const loginUrlToUse = login_url || SEI_LOGIN_URL;

        // Monta dados do formulário manualmente com encoding correto
        const formParams = [];

        // Adiciona campos ocultos raspados
        Object.entries(hiddenFields).forEach(([key, value]) => {
            formParams.push(`${urlEncodeISO(key)}=${urlEncodeISO(value)}`);
        });

        // Sobrescreve/Adiciona credenciais
        // Remove duplicatas se já existirem nos hidden fields
        const keysToOverride = ['txtUsuario', 'pwdSenha', 'selOrgao', 'sbmLogin', 'txtCaptcha'];
        const filteredParams = formParams.filter(p => !keysToOverride.some(k => p.startsWith(k + '=')));

        filteredParams.push(`txtUsuario=${urlEncodeISO(usuario)}`);
        filteredParams.push(`pwdSenha=${urlEncodeISO(senha)}`);
        filteredParams.push(`selOrgao=${urlEncodeISO(orgao || '0')}`); // Mapeamento de órgão deve ser feito no frontend ou aqui se tivermos a lista

        // Garante que sbmLogin exista
        if (!hiddenFields['sbmLogin']) {
            filteredParams.push(`sbmLogin=${urlEncodeISO('Acessar')}`);
        }

        if (captcha) {
            filteredParams.push(`txtCaptcha=${urlEncodeISO(captcha)}`);
        }

        const bodyString = filteredParams.join('&');

        // 2. Faz o POST de login
        const loginResponse = await makeRequest(loginUrlToUse, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://www.sei.mg.gov.br',
                'Referer': SEI_LOGIN_URL,
                'Upgrade-Insecure-Requests': '1'
            },
            body: bodyString
        });

        // Usa os cookies acumulados durante o login (incluindo redirects)
        const allCookies = loginResponse.cookieJar || {};
        const newCookieString = stringifyCookies(allCookies);

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

        // A interface moderna do SEI usa divs, não tabelas
        // Procura por links de processos com as classes específicas
        $('a.processoVisualizado, a.processoNaoVisualizado').each((i, link) => {
            const $link = $(link);
            const protocolo = $link.text().trim();
            const href = $link.attr('href');

            if (protocolo && href) {
                // Tenta extrair informações adicionais dos elementos próximos
                const $parent = $link.parent();

                processos.push({
                    protocolo,
                    link_sei: href.startsWith('http') ? href : `${SEI_BASE_URL}/${href}`,
                    interessados: '', // Pode precisar de scraping adicional
                    atribuido_a: '',
                    unidade: 'Padrão'
                });
            }
        });

        // Fallback: tenta método antigo com tabelas (caso versão antiga do SEI)
        if (processos.length === 0) {
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
        }

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
                    divProcessosFound: $('#divTabelaProcesso').length,
                    processLinksFound: $('a.processoVisualizado, a.processoNaoVisualizado').length,
                    tablesFound: $('table.infraTable').length,
                    rowsFound: $('table.infraTable tr').length,
                    linksFound: $('a.infraLinkProcesso').length,
                    htmlSnippet: finalResponse.data ? finalResponse.data.substring(0, 500) : "EMPTY RESPONSE",
                    statusCode: finalResponse.statusCode,
                    finalUrl: finalResponse.finalUrl,
                    redirectChain: finalResponse.redirectChain,
                    hiddenFieldsFound: hiddenFields,
                    loginUrlUsed: loginUrlToUse
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
