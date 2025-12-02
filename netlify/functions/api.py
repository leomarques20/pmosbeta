import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import dependencies from the layer
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import Optional, Dict
    from mangum import Mangum
    import requests
    from bs4 import BeautifulSoup
    import base64
except ImportError as e:
    import json
    def handler(event, context):
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Import error: {str(e)}"})
        }
else:
    # SEI URLs
    SEI_BASE_URL = "https://www.sei.mg.gov.br/sei"
    SEI_LOGIN_URL = "https://www.sei.mg.gov.br/sip/login.php?sigla_orgao_sistema=GOVMG&sigla_sistema=SEI"

    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class LoginRequest(BaseModel):
        usuario: str
        senha: str
        orgao: Optional[str] = "0"
        captcha: Optional[str] = None
        cookies: Dict[str, str]
        unidade_alvo: Optional[str] = None
        filtrar_meus: bool = False

    @app.get("/api")
    async def root():
        return {"status": "ok", "message": "SEI API is running"}

    @app.get("/api/sei/auth/challenge")
    async def get_challenge():
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        
        try:
            resp = session.get(SEI_LOGIN_URL)
            soup = BeautifulSoup(resp.content, 'html.parser')
            
            captcha_img = soup.find('img', id='lblCaptcha')
            captcha_base64 = None
            
            if captcha_img:
                captcha_src = captcha_img.get('src')
                if captcha_src:
                    if captcha_src.startswith('http'):
                        captcha_url = captcha_src
                    elif captcha_src.startswith('/'):
                        captcha_url = f"https://www.sei.mg.gov.br{captcha_src}"
                    else:
                        base_req = SEI_LOGIN_URL.rsplit('/', 1)[0]
                        captcha_url = f"{base_req}/{captcha_src}"

                    captcha_resp = session.get(captcha_url)
                    if captcha_resp.status_code == 200:
                        captcha_base64 = base64.b64encode(captcha_resp.content).decode('utf-8')
            
            return {
                "captcha_image": captcha_base64,
                "cookies": session.cookies.get_dict()
            }
        except Exception as e:
            return {
                "captcha_image": None,
                "cookies": {},
                "error": str(e)
            }

    @app.post("/api/sei/processos")
    async def get_processos(req: LoginRequest):
        return {"processos": [], "message": "Not implemented yet"}

    handler = Mangum(app)
