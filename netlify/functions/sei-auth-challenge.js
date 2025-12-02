const https = require('https');

exports.handler = async function (event, context) {
    const url = 'https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI&infra_url=L3NlaS8=';

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                // Procura pelo captcha na página
                const captchaMatch = data.match(/id="lblCaptcha"[^>]*src="([^"]+)"/);

                if (captchaMatch && captchaMatch[1]) {
                    let captchaUrl = captchaMatch[1];

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
                            const hiddenMatches = data.matchAll(/<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/g);
                            for (const match of hiddenMatches) {
                                hiddenFields[match[1]] = match[2];
                            }

                            // Extrai action do form
                            let loginUrl = url;
                            const actionMatch = data.match(/<form[^>]*action=["']([^"']+)["']/);
                            if (actionMatch && actionMatch[1]) {
                                let action = actionMatch[1];
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
