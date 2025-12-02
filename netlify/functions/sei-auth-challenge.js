const https = require('https');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

exports.handler = async function (event, context) {
    const url = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI&infra_url=L3NlaS8=';

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];

            res.on('data', (chunk) => {
                chunks.push(chunk);
            });

            res.on('end', () => {
                // Decode using correct encoding for SEI (ISO-8859-1/win1252)
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers['content-type'] || '';
                let encoding = 'win1252'; // Default para SEI
                if (contentType.includes('utf-8')) encoding = 'utf8';
                const data = iconv.decode(buffer, encoding);

                const $ = cheerio.load(data);

                // Procura pelo captcha na página
                const $captchaImg = $('#lblCaptcha');
                const captchaSrc = $captchaImg.attr('src');

                if (captchaSrc) {
                    let captchaUrl = captchaSrc;

                    // Monta URL completa do captcha
                    if (!captchaUrl.startsWith('http')) {
                        if (captchaUrl.startsWith('/')) {
                            captchaUrl = 'https://www.sei.mg.gov.br' + captchaUrl;
                        } else {
                            captchaUrl = 'https://www.sei.mg.gov.br/sip/' + captchaUrl;
                        }
                    }

                    // Busca a imagem do captcha
                    https.get(captchaUrl, (captchaRes) => {
                        const chunks = [];

                        captchaRes.on('data', (chunk) => {
                            chunks.push(chunk);
                        });

                        captchaRes.on('end', () => {
                            const captchaBuffer = Buffer.concat(chunks);
                            const captchaBase64 = captchaBuffer.toString('base64');

                            // Extrai cookies
                            const cookies = {};
                            const setCookieHeaders = res.headers['set-cookie'] || [];
                            setCookieHeaders.forEach(cookie => {
                                const parts = cookie.split(';')[0].split('=');
                                if (parts.length === 2) {
                                    cookies[parts[0]] = parts[1];
                                }
                            });

                            // Extrai campos ocultos
                            const hiddenFields = {};
                            $('input[type="hidden"]').each((i, el) => {
                                const name = $(el).attr('name');
                                const value = $(el).attr('value');
                                if (name) hiddenFields[name] = value || '';
                            });

                            // Extrai action do form
                            let loginUrl = url;
                            const formAction = $('form').attr('action');
                            if (formAction) {
                                let action = formAction;
                                if (!action.startsWith('http')) {
                                    if (action.startsWith('/')) {
                                        loginUrl = 'https://www.sei.mg.gov.br' + action;
                                    } else {
                                        loginUrl = 'https://www.sei.mg.gov.br/sip/' + action;
                                    }
                                } else {
                                    loginUrl = action;
                                }
                            }

                            // Se a action não tiver parâmetros, mas a URL original tiver, tenta preservar
                            if (loginUrl && !loginUrl.includes('?')) {
                                const originalQuery = url.split('?')[1];
                                if (originalQuery) {
                                    loginUrl += `?${originalQuery}`;
                                }
                            }

                            resolve({
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
                            });
                        });
                    }).on('error', () => {
                        // Sem captcha
                        resolve({
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify({
                                captcha_image: null,
                                cookies: {}
                            })
                        });
                    });
                } else {
                    // Sem captcha na página
                    resolve({
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            captcha_image: null,
                            cookies: {}
                        })
                    });
                }
            });
        }).on('error', (e) => {
            resolve({
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: e.message })
            });
        });
    });
};
