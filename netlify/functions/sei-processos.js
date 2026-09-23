const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// Helper to encode params for ISO-8859-1
function urlEncodeISO(str) {
    if (!str) return '';
    const buffer = iconv.encode(str, 'win1252');
    let res = '';
    for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
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

// Helper to manage cookies with Axios manually
async function requestWithCookies(client, config, jar, url) {
    // Add cookies to request
    const cookies = await jar.getCookies(url);
    const cookieHeader = cookies.map(c => c.cookieString()).join('; ');

    const newConfig = { ...config };
    if (cookieHeader) {
        newConfig.headers = { ...newConfig.headers, 'Cookie': cookieHeader };
    }

    const response = await client.request(newConfig);

    // Store cookies from response
    if (response.headers['set-cookie']) {
        const setCookies = response.headers['set-cookie'];
        for (const cookieStr of setCookies) {
            await jar.setCookie(cookieStr, url);
        }
    }

    return response;
}

const SEI_HOST = 'www.sei.mg.gov.br';

exports.handler = async function (event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
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
    } catch (err) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Corpo da requisição inválido.' })
        };
    }

    const { usuario, senha, orgao, captcha, cookies, hidden_fields, login_url } = payload || {};
    if (typeof usuario !== 'string' || !usuario.trim() || typeof senha !== 'string' || !senha) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Usuário e senha são obrigatórios.', processos: [] })
        };
    }
    const SEI_LOGIN_URL = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI';
    // Só aceita URL de login do próprio SEI (evita enviar credenciais para outro host)
    let loginTarget = SEI_LOGIN_URL;
    try {
        const candidate = login_url ? new URL(login_url) : null;
        if (candidate && candidate.protocol === 'https:' && candidate.hostname === SEI_HOST) loginTarget = candidate.toString();
    } catch (e) { /* usa o padrão */ }
    const loginUrlObj = new URL(loginTarget);
    const SEI_BASE_URL = loginUrlObj.origin;

    // Setup Cookie Jar
    const jar = new CookieJar(undefined, { rejectPublicSuffixes: false });

    // Restore cookies from frontend
    if (cookies && typeof cookies === 'object') {
        for (const [key, value] of Object.entries(cookies)) {
            try {
                // Map cookies back to the login host to preserve session.
                await jar.setCookie(`${key}=${value}; Domain=${loginUrlObj.hostname}; Path=/`, loginTarget);
            } catch (e) {
                console.warn("Error setting cookie:", key, e.message);
            }
        }
    }

    const client = axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': SEI_BASE_URL,
            'Referer': loginTarget
        },
        responseType: 'arraybuffer',
        validateStatus: () => true, // Handle all status codes manually
        maxRedirects: 0 // Handle redirects manually to capture cookies
    });

    try {
        // Prepare Form Data
        const hiddenFields = (hidden_fields && typeof hidden_fields === 'object') ? { ...hidden_fields } : {};

        // Defaults
        if (!hiddenFields['hdnAcao']) hiddenFields['hdnAcao'] = '1';
        if (!hiddenFields['hdnInfraPrefixoCookie']) hiddenFields['hdnInfraPrefixoCookie'] = 'Sistema_Eletrônico_de_Informações';

        const formParams = [];
        Object.entries(hiddenFields).forEach(([key, value]) => {
            // Filter out fields we will explicitly set
            if (!['txtUsuario', 'pwdSenha', 'selOrgao', 'sbmLogin', 'txtCaptcha'].includes(key)) {
                formParams.push(`${urlEncodeISO(key)}=${urlEncodeISO(value == null ? '' : String(value))}`);
            }
        });

        formParams.push(`txtUsuario=${urlEncodeISO(usuario)}`);
        formParams.push(`pwdSenha=${urlEncodeISO(senha)}`);
        formParams.push(`selOrgao=${urlEncodeISO(String(orgao || '0'))}`);
        formParams.push(`sbmLogin=${urlEncodeISO('Acessar')}`);
        if (captcha) {
            formParams.push(`txtCaptcha=${urlEncodeISO(String(captcha))}`);
        }

        const bodyString = formParams.join('&');

        // 1. Perform Login
        let response = await requestWithCookies(client, {
            url: loginTarget,
            method: 'POST',
            data: bodyString,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, jar, loginTarget);

        // Handle Redirects (Manual loop)
        let currentUrl = loginTarget;
        let redirectCount = 0;
        const maxRedirects = 5;

        while (response.status >= 300 && response.status < 400 && response.headers.location && redirectCount < maxRedirects) {
            redirectCount++;
            // Resolve relativo à URL atual (ex.: "controlador.php?..." dentro de /sei/)
            const redirectUrl = new URL(response.headers.location, currentUrl).toString();

            console.log(`Redirecting to: ${redirectUrl}`);
            currentUrl = redirectUrl;

            response = await requestWithCookies(client, {
                url: redirectUrl,
                method: 'GET'
            }, jar, redirectUrl);
        }

        // Check if login was successful
        // Decode response
        let contentType = response.headers['content-type'] || '';
        let encoding = 'win1252';
        if (contentType.includes('utf-8')) encoding = 'utf8';
        let html = iconv.decode(response.data, encoding);

        // Check for login error
        if (html.includes('txtUsuario') && html.includes('pwdSenha')) {
            // Still on login page
            const $ = cheerio.load(html);
            const msg = $('#divInfraMensagens').text().trim();
            const err = new Error(msg || "Falha no login. Verifique as credenciais e o captcha.");
            err.statusCode = 401;
            throw err;
        }

        // If not on process list, try to navigate to it
        if (!html.includes('infraTable') && !html.includes('processoVisualizado')) {
            // Force navigation to control panel
            const controlUrl = `${SEI_BASE_URL}/sei/controlador.php?acao=procedimento_controlar&acao_origem=procedimento_controlar&acao_retorno=procedimento_controlar&id_procedimento_atual=&id_documento_atual=&infra_sistema=100000100`;
            const controlResponse = await requestWithCookies(client, { url: controlUrl, method: 'GET' }, jar, controlUrl);

            contentType = controlResponse.headers['content-type'] || '';
            encoding = 'win1252';
            if (contentType.includes('utf-8')) encoding = 'utf8';
            html = iconv.decode(controlResponse.data, encoding);
            currentUrl = controlUrl;
        }

        // 2. Parse Processes
        const $ = cheerio.load(html);
        const processos = [];

        // Modern SEI (Div based)
        $('a.processoVisualizado, a.processoNaoVisualizado').each((i, link) => {
            const $link = $(link);
            const protocolo = $link.text().trim();
            const href = $link.attr('href');

            if (protocolo && href) {
                processos.push({
                    protocolo,
                    link_sei: new URL(href, currentUrl).toString(),
                    interessados: '', // Hard to get in div layout without more context
                    atribuido_a: '',
                    unidade: 'Padrão'
                });
            }
        });

        // Legacy SEI (Table based) - Fallback
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
                            link_sei: href ? new URL(href, currentUrl).toString() : '',
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
                success: true,
                processos,
                total: processos.length,
                debug: {
                    finalUrl: currentUrl,
                    processosFound: processos.length
                }
            })
        };

    } catch (error) {
        console.error("SEI Processos Error:", error && error.message);
        const statusCode = error.statusCode || 500;
        return {
            statusCode,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: false,
                // Mensagens 401 vêm da própria página do SEI; demais erros não expõem detalhes internos
                error: statusCode === 401 ? error.message : 'Erro ao buscar processos no SEI.',
                processos: []
            })
        };
    }
};
