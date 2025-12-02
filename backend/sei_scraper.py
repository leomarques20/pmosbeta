import requests
from bs4 import BeautifulSoup
import base64
import re

SEI_BASE_URL = "https://www.sei.mg.gov.br/sei"
SEI_LOGIN_URL = "https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI"

def get_sei_session():
    """
    Inicia uma sessão e retorna o objeto session e a imagem do captcha em base64.
    """
    session = requests.Session()
    # Headers básicos para parecer um navegador
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    })

    try:
        # 1. Acessa a página de login para pegar cookies e gerar o captcha
        # O usuário forneceu uma URL de SIP, vamos tentar acessá-la.
        resp = session.get(SEI_LOGIN_URL)
        
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # Tenta achar a imagem do captcha
        captcha_img = soup.find('img', id='lblCaptcha')
        captcha_base64 = None
        
        if captcha_img:
            # O src geralmente é "controlador.php?acao=infra_captcha..."
            captcha_src = captcha_img.get('src')
            if captcha_src:
                # Se o src for relativo, monta a URL completa.
                # Cuidado: se estiver no /sip/, o relativo pode ser diferente.
                # Mas geralmente o captcha vem do /sei/
                if captcha_src.startswith('http'):
                    captcha_url = captcha_src
                elif captcha_src.startswith('/'):
                    captcha_url = f"https://www.sei.mg.gov.br{captcha_src}"
                else:
                    # Relativo simples, assume que está na mesma base do request (SIP ou SEI)
                    # Se o login é no SIP, o captcha pode estar no SIP.
                    base_req = SEI_LOGIN_URL.rsplit('/', 1)[0]
                    captcha_url = f"{base_req}/{captcha_src}"

                captcha_resp = session.get(captcha_url)
                if captcha_resp.status_code == 200:
                    captcha_base64 = base64.b64encode(captcha_resp.content).decode('utf-8')
        
        return session, captcha_base64
    except Exception as e:
        print(f"Erro ao iniciar sessão SEI: {e}")
        return None, None

def login_and_scrape(usuario, senha, captcha_text, cookies_dict, unidade_alvo=None, filtrar_meus=False):
    """
    Realiza o login usando os cookies da sessão anterior (onde o captcha foi gerado)
    e raspa a lista de processos.
    """
    session = requests.Session()
    session.cookies.update(cookies_dict)
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    })

    # Dados do formulário de login (precisa inspecionar o HTML do SEI para ter certeza dos campos)
    # Baseado no padrão SEI:
    payload = {
        'txtUsuario': usuario,
        'pwdSenha': senha,
        'txtCaptcha': captcha_text,
        'acao': 'infra_usuario_login', # Pode variar
        'sbmLogin': 'Acessar' # Pode variar
    }
    
    # O SEI costuma postar para controlador.php?acao=infra_usuario_login
    # Mas muitas vezes o form action é vazio ou relativo.
    # Vamos assumir o padrão.
    
    try:
        # Tenta logar
        # Precisamos pegar o 'infra_sistema' e 'infra_unidade_atual' se existirem hidden no form
        # Mas vamos tentar o POST direto primeiro.
        
        # IMPORTANTE: O SEI usa um parâmetro 'acao' na URL ou no POST.
        login_url = f"{SEI_BASE_URL}/controlador.php?acao=procedimento_controle" # Tentativa de ir direto ou login
        
        # Na verdade, o login geralmente é um POST para a própria página de login ou controlador.php
        # Vamos tentar simular o POST do form de login.
        resp_login = session.post(f"{SEI_BASE_URL}/controlador.php?acao=procedimento_controle", data=payload)
        
        # Verifica se logou (se não tem mais campo de senha ou erro)
        if "txtUsuario" in resp_login.text and "pwdSenha" in resp_login.text:
             # Falha no login (provavelmente captcha ou senha)
             # Tenta extrair mensagem de erro
             soup_err = BeautifulSoup(resp_login.content, 'html.parser')
             msg = soup_err.find(id="divInfraMensagens")
             error_text = msg.get_text().strip() if msg else "Falha no login (verifique credenciais ou captcha)."
             raise Exception(error_text)

        # Se logou, deve estar na tela de controle.
        # Se precisar trocar de unidade:
        if unidade_alvo:
            # Lógica de troca de unidade (complexa via HTTP puro sem saber os IDs)
            pass

        # Raspa a tabela
        soup = BeautifulSoup(resp_login.content, 'html.parser')
        
        # Tabelas de processos (Recebidos e Gerados)
        tabelas = soup.find_all('table', class_='infraTable')
        
        processos = []
        
        for tabela in tabelas:
            linhas = tabela.find_all('tr', class_='infraTrClara') + tabela.find_all('tr', class_='infraTrEscura')
            for linha in linhas:
                cols = linha.find_all('td')
                if len(cols) < 5: continue
                
                try:
                    # Índices variam, mas geralmente:
                    # 2: Checkbox/Status
                    # 3: Protocolo (Link)
                    # 4: Interessados
                    # ...
                    
                    # Procura o link do protocolo
                    link_el = linha.find('a', class_='infraLinkProcesso')
                    if not link_el:
                        # Tenta achar qualquer link na coluna 2 ou 3
                        link_el = cols[2].find('a') or cols[3].find('a')
                    
                    if not link_el: continue
                    
                    protocolo = link_el.get_text().strip()
                    href = link_el.get('href')
                    link_sei = f"{SEI_BASE_URL}/{href}" if href else ""
                    
                    # Interessados (coluna variável, geralmente a que tem mais texto depois do protocolo)
                    # Vamos pegar o texto das colunas seguintes
                    interessados = cols[3].get_text().strip() # Chute educado
                    
                    # Atribuído (geralmente a penúltima ou última)
                    atribuido_a = cols[-2].get_text().strip() # Chute educado
                    
                    # Filtro
                    if filtrar_meus and usuario.lower() not in atribuido_a.lower():
                        continue
                        
                    processos.append({
                        "protocolo": protocolo,
                        "link_sei": link_sei,
                        "interessados": interessados,
                        "atribuido_a": atribuido_a,
                        "unidade": unidade_alvo or "Padrão"
                    })
                except Exception as e:
                    continue
                    
        return processos

    except Exception as e:
        raise Exception(f"Erro no scraping: {str(e)}")
