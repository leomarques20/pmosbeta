const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// Helper to encode params for ISO-8859-1 (Reuse from sei-processos.js)
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
    const cookies = await jar.getCookies(url);
    const cookieHeader = cookies.map(c => c.cookieString()).join('; ');

    const newConfig = { ...config };
    if (cookieHeader) {
        newConfig.headers = { ...newConfig.headers, 'Cookie': cookieHeader };
    }

    const response = await client.request(newConfig);

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

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (err) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { usuario, senha, orgao, link_sei, cookies } = payload;

    if (!link_sei) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Link do processo é obrigatório.' }) };
    }

    const SEI_LOGIN_URL = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI';
    const loginUrlObj = new URL(SEI_LOGIN_URL);
    const SEI_BASE_URL = loginUrlObj.origin;

    const jar = new CookieJar(undefined, { rejectPublicSuffixes: false });

    // Restore cookies if provided
    if (cookies) {
        for (const [key, value] of Object.entries(cookies)) {
            try {
                await jar.setCookie(`${key}=${value}; Domain=${loginUrlObj.hostname}; Path=/`, SEI_LOGIN_URL);
            } catch (e) { }
        }
    }

    const client = axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': SEI_BASE_URL,
            'Referer': SEI_LOGIN_URL
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
        maxRedirects: 0
    });

    try {
        // 1. Check if session is valid by accessing the link directly
        let response = await requestWithCookies(client, { url: link_sei, method: 'GET' }, jar, link_sei);

        // If redirected to login, perform login
        if (response.status >= 300 && response.headers.location && response.headers.location.includes('login.php')) {
            console.log("Session expired, logging in...");
            // Perform Login (Simplified version, assuming captcha not needed for re-auth if session just expired, or we fail)
            // Ideally we should reuse the full login flow, but for brevity let's assume valid cookies or fail.
            // If we need to login, we need the full params.

            // For this implementation, let's assume the frontend passes valid cookies or we fail and ask to refresh dashboard.
            // Re-implementing full login here is complex without captcha handling.
            // Let's try to login without captcha if possible (sometimes works for re-auth) or fail.

            const formParams = [];
            formParams.push(`txtUsuario=${urlEncodeISO(usuario)}`);
            formParams.push(`pwdSenha=${urlEncodeISO(senha)}`);
            formParams.push(`selOrgao=${urlEncodeISO(orgao || '0')}`);
            formParams.push(`sbmLogin=${urlEncodeISO('Acessar')}`);
            formParams.push(`hdnAcao=1`);
            formParams.push(`hdnInfraPrefixoCookie=Sistema_Eletrônico_de_Informações`);

            response = await requestWithCookies(client, {
                url: SEI_LOGIN_URL,
                method: 'POST',
                data: formParams.join('&'),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }, jar, SEI_LOGIN_URL);

            // Handle Redirects
            let currentUrl = SEI_LOGIN_URL;
            let redirectCount = 0;
            while (response.status >= 300 && response.headers.location && redirectCount < 5) {
                redirectCount++;
                let redirectUrl = response.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = new URL(redirectUrl, new URL(currentUrl).origin).toString();
                }
                currentUrl = redirectUrl;
                response = await requestWithCookies(client, { url: redirectUrl, method: 'GET' }, jar, redirectUrl);
            }

            // Retry accessing the process link
            response = await requestWithCookies(client, { url: link_sei, method: 'GET' }, jar, link_sei);
        }

        let html = iconv.decode(response.data, 'iso-8859-1'); // SEI usually uses this
        let $ = cheerio.load(html);

        // 2. Extract Document Tree (iframe 'ifrArvore')
        const treeIframeSrc = $('#ifrArvore').attr('src');
        let treeData = [];

        if (treeIframeSrc) {
            const treeUrl = treeIframeSrc.startsWith('http') ? treeIframeSrc : `${SEI_BASE_URL}/${treeIframeSrc}`;
            const treeResp = await requestWithCookies(client, { url: treeUrl, method: 'GET' }, jar, treeUrl);
            const treeHtml = iconv.decode(treeResp.data, 'iso-8859-1');
            const $tree = cheerio.load(treeHtml);

            // Parse tree elements (simplified)
            $tree('a[target="ifrVisualizacao"]').each((i, el) => {
                const $el = $tree(el);
                const text = $el.text().trim();
                const href = $el.attr('href');
                const isFolder = $el.find('img').attr('src')?.includes('pasta');

                if (text) {
                    treeData.push({
                        title: text,
                        link: href ? `${SEI_BASE_URL}/${href}` : null,
                        type: isFolder ? 'folder' : 'document'
                    });
                }
            });
        }

        // 3. Extract History (iframe 'ifrVisualizacao' -> 'Consultar Andamentos')
        // This is trickier because 'ifrVisualizacao' usually loads the last doc.
        // We need to find the link to "Consultar Andamentos" which is usually in the top frame or accessible via specific action.
        // A reliable way is to construct the URL for "controlador.php?acao=andamento_listar..." if we have id_procedimento.

        let historyData = [];
        const idProcedimentoMatch = link_sei.match(/id_procedimento=(\d+)/);
        if (idProcedimentoMatch) {
            const idProcedimento = idProcedimentoMatch[1];
            const historyUrl = `${SEI_BASE_URL}/controlador.php?acao=andamento_listar&id_procedimento=${idProcedimento}&infra_sistema=100000100&infra_unidade_atual=110000008&infra_hash=`; // Hash might be needed...

            // Actually, let's try to find the link in the main page or tree page if possible.
            // But constructing is often easier if we don't need hash. SEI usually needs hash for some actions.
            // Let's try to fetch the main process view (procedimento_trabalhar) and look for the link.

            // If we are at 'procedimento_trabalhar', the history is usually a button/link.
            // Let's assume we can't easily get history without complex navigation for now, 
            // OR we can try to parse the 'Consultar Andamentos' from the tree view if it exists there (sometimes it does).

            // Alternative: Just return the tree for now, and maybe the last few docs are enough for "Quick View".
            // But user asked for "Andamentos".

            // Let's try to fetch the history URL directly. It usually works if session is active.
            const historyResp = await requestWithCookies(client, { url: historyUrl, method: 'GET' }, jar, historyUrl);
            const historyHtml = iconv.decode(historyResp.data, 'iso-8859-1');
            const $hist = cheerio.load(historyHtml);

            $hist('table.infraTable tbody tr').each((i, row) => {
                const cols = $hist(row).find('td');
                if (cols.length >= 3) {
                    historyData.push({
                        data: $hist(cols[0]).text().trim(),
                        unidade: $hist(cols[1]).text().trim(),
                        descricao: $hist(cols[2]).text().trim()
                    });
                }
            });
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                tree: treeData,
                history: historyData
            })
        };

    } catch (error) {
        console.error("SEI Detalhes Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Erro ao buscar detalhes.' })
        };
    }
};
