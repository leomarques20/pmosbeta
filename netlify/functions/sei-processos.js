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

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const { usuario, senha, orgao, captcha, cookies, hidden_fields, login_url } = JSON.parse(event.body);
    const SEI_BASE_URL = 'https://www.sei.mg.gov.br';
    const SEI_LOGIN_URL = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI';

    // Setup Cookie Jar
    const jar = new CookieJar();

    // Restore cookies from frontend
    if (cookies) {
        for (const [key, value] of Object.entries(cookies)) {
            try {
                // We need to set the cookie for the correct domain.
                // Assuming standard SEI domain.
                await jar.setCookie(`${key}=${value}; Domain=www.sei.mg.gov.br; Path=/`, SEI_LOGIN_URL);
            } catch (e) {
                console.warn("Error setting cookie:", key, e);
            }
        }
    }

    const client = axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://www.sei.mg.gov.br',
            'Referer': SEI_LOGIN_URL
        },
        responseType: 'arraybuffer',
        validateStatus: () => true, // Handle all status codes manually
        maxRedirects: 0 // Handle redirects manually to capture cookies
    });

    try {
        // Prepare Form Data
        const hiddenFields = hidden_fields || {};

        // Defaults
        if (!hiddenFields['hdnAcao']) hiddenFields['hdnAcao'] = '1';
        if (!hiddenFields['hdnInfraPrefixoCookie']) hiddenFields['hdnInfraPrefixoCookie'] = 'Sistema_Eletrônico_de_Informações';

        const formParams = [];
        Object.entries(hiddenFields).forEach(([key, value]) => {
            // Filter out fields we will explicitly set
            if (!['txtUsuario', 'pwdSenha', 'selOrgao', 'sbmLogin', 'txtCaptcha'].includes(key)) {
                formParams.push(`${urlEncodeISO(key)}=${urlEncodeISO(value)}`);
            }
        });

        formParams.push(`txtUsuario=${urlEncodeISO(usuario)}`);
        formParams.push(`pwdSenha=${urlEncodeISO(senha)}`);
        formParams.push(`selOrgao=${urlEncodeISO(orgao || '0')}`);
        formParams.push(`sbmLogin=${urlEncodeISO('Acessar')}`);
        if (captcha) {
            formParams.push(`txtCaptcha=${urlEncodeISO(captcha)}`);
        }

        const bodyString = formParams.join('&');
        const loginTarget = login_url || SEI_LOGIN_URL;

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
            let redirectUrl = response.headers.location;
            if (!redirectUrl.startsWith('http')) {
                const baseUrl = new URL(currentUrl).origin;
                redirectUrl = new URL(redirectUrl, baseUrl).toString();
            }

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
            throw new Error(msg || "Falha no login. Verifique as credenciais e o captcha.");
        }

        // If not on process list, try to navigate to it
        if (!html.includes('infraTable') && !html.includes('processoVisualizado')) {
            // Force navigation to control panel
            const controlUrl = `${SEI_BASE_URL}/controlador.php?acao=procedimento_controlar&acao_origem=procedimento_controlar&acao_retorno=procedimento_controlar&id_procedimento_atual=&id_documento_atual=&infra_sistema=100000100`;
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
                    link_sei: href.startsWith('http') ? href : `${SEI_BASE_URL}/${href}`,
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
                    finalUrl: currentUrl,
                    processosFound: processos.length
                }
            })
        };

    } catch (error) {
        console.error("SEI Processos Error:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                error: error.message,
                processos: []
            })
        };
    }
};
