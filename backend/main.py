from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
from backend.sei_scraper import get_sei_session, login_and_scrape
from mangum import Mangum
import uvicorn

app = FastAPI()

# Configuração CORS para permitir acesso do frontend (mesmo domínio ou localhost)
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
    captcha: str
    cookies: Dict[str, str]
    unidade_alvo: Optional[str] = None
    filtrar_meus: bool = False

@app.get("/api/sei/auth/challenge")
async def get_challenge():
    """
    Retorna um novo captcha e os cookies da sessão para o cliente manter o estado.
    """
    session, captcha_b64 = get_sei_session()
    if not session:
        raise HTTPException(status_code=500, detail="Não foi possível conectar ao SEI.")
    
    return {
        "captcha_image": captcha_b64,
        "cookies": session.cookies.get_dict()
    }

@app.post("/api/sei/processos")
async def get_processos(req: LoginRequest):
    """
    Recebe credenciais + captcha + cookies da sessão anterior,
    realiza login e retorna processos.
    """
    try:
        processos = login_and_scrape(
            usuario=req.usuario,
            senha=req.senha,
            captcha_text=req.captcha,
            cookies_dict=req.cookies,
            unidade_alvo=req.unidade_alvo,
            filtrar_meus=req.filtrar_meus
        )
        return {"processos": processos}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# Handler para Netlify Functions (AWS Lambda adapter)
handler = Mangum(app)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
