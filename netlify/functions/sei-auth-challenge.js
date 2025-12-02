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

exports.handler = async function (event, context) {
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

        // Decode response
        const contentType = response.headers['content-type'] || '';
        let encoding = 'win1252';
        if (contentType.includes('utf-8')) encoding = 'utf8';
        const html = iconv.decode(response.data, encoding);

        const $ = cheerio.load(html);

        // 2. Extract Captcha URL
        const $captchaImg = $('#lblCaptcha');
        const captchaSrc = $captchaImg.attr('src');

        let captchaBase64 = null;

        if (captchaSrc) {
            let captchaUrl = captchaSrc;
            if (!captchaUrl.startsWith('http')) {
                if (captchaUrl.startsWith('/')) {
                    captchaUrl = SEI_BASE_URL + captchaUrl;
                } else {
                    // Relative to current path (usually /sip/)
                    captchaUrl = SEI_BASE_URL + '/sip/' + captchaUrl;
                }
            }

            // 3. Fetch Captcha Image
            try {
                const captchaResponse = await requestWithCookies(client, { url: captchaUrl, method: 'GET', responseType: 'arraybuffer' }, jar, captchaUrl);
                captchaBase64 = Buffer.from(captchaResponse.data).toString('base64');
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
            if (!formAction.startsWith('http')) {
                if (formAction.startsWith('/')) {
                    loginUrl = SEI_BASE_URL + formAction;
                } else {
                    loginUrl = SEI_BASE_URL + '/sip/' + formAction;
                }
            } else {
                loginUrl = formAction;
            }
        }

        // Preserve query params if action is bare
        if (loginUrl && !loginUrl.includes('?') && SEI_LOGIN_URL.includes('?')) {
            loginUrl += '?' + SEI_LOGIN_URL.split('?')[1];
        }

        // 6. Get Cookies
        const cookies = {};
        const storedCookies = await jar.getCookies(SEI_LOGIN_URL);
        storedCookies.forEach(c => {
            cookies[c.key] = c.value;
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                captcha_image: captchaBase64,
                cookies: cookies,
                hidden_fields: hiddenFields,
                login_url: loginUrl
            })
        };

    } catch (error) {
        console.error("SEI Auth Challenge Error:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
