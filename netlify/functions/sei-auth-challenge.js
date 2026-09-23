const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

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

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async function (event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const jar = new CookieJar();
    const client = axios.create({
        withCredentials: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        responseType: 'arraybuffer',
        validateStatus: () => true // Handle all status codes manually
    });

    const SEI_LOGIN_URL = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI&infra_url=L3NlaS8=';
    const SEI_BASE_URL = 'https://www.sei.mg.gov.br';

    try {
        // 1. Access Login Page
        const response = await requestWithCookies(client, { url: SEI_LOGIN_URL, method: 'GET' }, jar, SEI_LOGIN_URL);
        if (response.status >= 400) {
            throw new Error(`SEI respondeu HTTP ${response.status} na página de login`);
        }

        // Decode response
        const contentType = response.headers['content-type'] || '';
        let encoding = 'win1252';
        if (contentType.includes('utf-8')) encoding = 'utf8';
        const html = iconv.decode(response.data, encoding);

        const $ = cheerio.load(html);

        // 2. Extract Captcha URL (o id pode estar na própria <img> ou num <label> que a envolve)
        let $captchaImg = $('#lblCaptcha');
        if (!$captchaImg.is('img')) {
            $captchaImg = $('#lblCaptcha img, #imgCaptcha, img[src*="captcha" i]').first();
        }
        const captchaSrc = $captchaImg.attr('src');

        let captchaBase64 = null;
        let captchaMime = 'image/png';

        if (captchaSrc) {
            // Resolve relativo à página de login (normalmente /sip/)
            const captchaUrl = new URL(captchaSrc, SEI_LOGIN_URL).toString();

            // 3. Fetch Captcha Image (mesma sessão/cookie jar do login)
            try {
                const captchaResponse = await requestWithCookies(client, { url: captchaUrl, method: 'GET', responseType: 'arraybuffer' }, jar, captchaUrl);
                if (captchaResponse.status >= 200 && captchaResponse.status < 300) {
                    captchaBase64 = Buffer.from(captchaResponse.data).toString('base64');
                    const ct = String(captchaResponse.headers['content-type'] || '').split(';')[0].trim();
                    if (ct.startsWith('image/')) captchaMime = ct;
                } else {
                    console.error("Error fetching captcha image: HTTP", captchaResponse.status);
                }
            } catch (err) {
                console.error("Error fetching captcha image:", err.message);
            }
        }

        // 4. Extract Hidden Fields
        const hiddenFields = {};
        $('input[type="hidden"]').each((i, el) => {
            const name = $(el).attr('name');
            const value = $(el).attr('value');
            if (name) hiddenFields[name] = value || '';
        });

        // Ensure critical fields exist
        if (!hiddenFields['hdnAcao']) {
            const val = $('input[name="hdnAcao"]').val();
            if (val) hiddenFields['hdnAcao'] = val;
        }

        // 5. Extract Login Action URL
        let loginUrl = SEI_LOGIN_URL;
        const formAction = $('form').attr('action');
        if (formAction) {
            loginUrl = new URL(formAction, SEI_LOGIN_URL).toString();
        }

        // Preserve query params if action is bare
        if (loginUrl && !loginUrl.includes('?') && SEI_LOGIN_URL.includes('?')) {
            loginUrl += '?' + SEI_LOGIN_URL.split('?')[1];
        }

        // 6. Get Cookies
        // Inclui todos os cookies do SEI (ex.: definidos na resposta do captcha com outro path),
        // priorizando os que valem para a URL de login, para que o login use a MESMA sessão do captcha.
        const cookies = {};
        const serialized = await jar.serialize();
        (serialized.cookies || []).forEach(c => {
            if (c.domain && SEI_BASE_URL.endsWith(c.domain.replace(/^\./, ''))) cookies[c.key] = c.value;
        });
        const storedCookies = await jar.getCookies(loginUrl);
        storedCookies.forEach(c => {
            cookies[c.key] = c.value;
        });

        return {
            statusCode: 200,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
            body: JSON.stringify({
                captcha_image: captchaBase64,
                captcha_mime: captchaMime,
                cookies: cookies,
                hidden_fields: hiddenFields,
                login_url: loginUrl
            })
        };

    } catch (error) {
        console.error("SEI Auth Challenge Error:", error.message);
        return {
            statusCode: 502,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Não foi possível obter o captcha do SEI.' })
        };
    }
};
