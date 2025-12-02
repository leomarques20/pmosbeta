const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const { usuario, senha, orgao, captcha } = JSON.parse(event.body);

    let browser = null;

    try {
        console.log('Launching browser...');

        // Configurações para @sparticuz/chromium
        chromium.setGraphicsMode = false;

        // Lança navegador Chrome headless
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();

        // Configura User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Navigating to SEI login page...');

        // 1. Acessa página de login
        await page.goto('https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('Filling login form...');

        // 2. Preenche formulário
        await page.waitForSelector('#txtUsuario', { timeout: 10000 });
        await page.type('#txtUsuario', usuario);
        await page.type('#pwdSenha', senha);

        // Seleciona órgão
        if (orgao) {
            await page.select('#selOrgao', orgao);
        }

        // Preenche captcha se fornecido
        if (captcha) {
            await page.type('#txtCaptcha', captcha);
        }

        console.log('Submitting login...');

        // 3. Faz login e aguarda navegação
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            page.click('#Acessar')
        ]);

        console.log('Checking login result...');

        // 4. Verifica se logou com sucesso
        const currentUrl = page.url();
        console.log('Current URL after login:', currentUrl);

        if (currentUrl.includes('login.php')) {
            // Ainda na página de login = falha
            const errorMsg = await page.evaluate(() => {
                const msgDiv = document.querySelector('#divInfraMensagens, .infraMensagemAlerta, .infraMensagemErro');
                return msgDiv ? msgDiv.textContent.trim() : 'Credenciais inválidas ou captcha incorreto';
            });

            await browser.close();

            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: errorMsg,
                    processos: []
                })
            };
        }

        console.log('Login successful! Extracting processes...');

        // 5. Busca processos na página atual ou navega para a lista
        let processos = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a.processoVisualizado, a.processoNaoVisualizado'));
            return links.map(link => {
                // Tenta extrair a descrição do tooltip (onmouseover ou title)
                let descricao = '';
                const onmouseover = link.getAttribute('onmouseover');
                if (onmouseover) {
                    // Formato comum: return infraTooltipMostrar('Descrição do Processo', 'Texto da descrição');
                    const match = onmouseover.match(/'[^']+',\s*'([^']+)'/);
                    if (match && match[1]) {
                        descricao = match[1];
                    }
                }
                if (!descricao) {
                    descricao = link.getAttribute('title') || '';
                }

                // Tenta encontrar interessados
                let interessados = '';
                const container = link.parentElement;
                if (container) {
                    const text = container.textContent;
                    const protocolo = link.textContent.trim();
                    const resto = text.replace(protocolo, '').trim();
                    if (resto.length > 0) {
                        interessados = resto;
                    }
                }

                return {
                    protocolo: link.textContent.trim(),
                    link_sei: link.href,
                    descricao: descricao,
                    interessados: interessados,
                    atribuido_a: '',
                    unidade: 'Padrão'
                };
            });
        });

        // Se não encontrou processos, tenta navegar para a página de controle
        if (processos.length === 0) {
            console.log('No processes found on current page, navigating to control panel...');
            await page.goto('https://www.sei.mg.gov.br/sei/controlador.php?acao=procedimento_controlar', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            processos = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a.processoVisualizado, a.processoNaoVisualizado'));
                return links.map(link => {
                    // Tenta extrair a descrição do tooltip (onmouseover ou title)
                    let descricao = '';
                    const onmouseover = link.getAttribute('onmouseover');
                    if (onmouseover) {
                        // Formato esperado: return infraTooltipMostrar('Título', 'Descrição');
                        // Regex captura: 1=Título, 2=Descrição. Suporta aspas simples ou duplas.
                        const match = onmouseover.match(/infraTooltipMostrar\s*\(\s*(?:'|")(.*?)(?:'|")\s*,\s*(?:'|")(.*?)(?:'|")\s*\)/);
                        if (match && match[2]) {
                            descricao = match[2];
                        }
                    }
                    if (!descricao) {
                        // Evita usar o title se ele for igual ao protocolo (comum em alguns casos)
                        const title = link.getAttribute('title') || '';
                        const text = link.textContent.trim();
                        if (title && title !== text) {
                            descricao = title;
                        }
                    }

                    // Tenta encontrar interessados (geralmente em uma coluna próxima ou texto após o link)
                    // No layout de divs, pode ser difícil sem estrutura fixa, mas vamos tentar pegar o texto do container pai
                    let interessados = '';
                    // Lógica simplificada: se houver texto após o link no mesmo container
                    const container = link.parentElement;
                    if (container) {
                        const text = container.textContent;
                        // Remove o protocolo do texto para tentar isolar o resto
                        const protocolo = link.textContent.trim();
                        const resto = text.replace(protocolo, '').trim();
                        if (resto.length > 0) {
                            interessados = resto; // Pode conter lixo, mas é um começo
                        }
                    }

                    return {
                        protocolo: link.textContent.trim(),
                        link_sei: link.href,
                        descricao: descricao,
                        interessados: interessados,
                        atribuido_a: '',
                        unidade: 'Padrão'
                    };
                });
            });
        }

        console.log(`Found ${processos.length} processes`);

        await browser.close();

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
        console.error('SEI Puppeteer Error:', error);

        if (browser) {
            await browser.close().catch(err => console.error('Error closing browser:', err));
        }

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                processos: []
            })
        };
    }
};
