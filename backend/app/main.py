import logging
import os
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import data, ml, scoring
from app.routes import ROUTERS
from app.store import Store

log = logging.getLogger("radar")

_CODIGOS = {
    401: "nao_autenticado",
    403: "nao_autorizado",
    404: "nao_encontrado",
    405: "nao_encontrado",
    422: "parametro_invalido",
}


def _erro(status: int, codigo: str, mensagem: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"erro": {"codigo": codigo, "mensagem": mensagem}})


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = None
    app.state.load_error = None
    try:
        db_url = os.environ.get("DATABASE_URL")
        ds = data.load_all(os.environ["DATA_DIR"], db_url)
        riscos = scoring.compute_all(ds)
        ml.assign_profiles(riscos)
        try:
            ml.train_churn_sim()
        except Exception as e:
            log.warning("churn simulado indisponível: %s", e)
        app.state.store = Store(ds, riscos, db_url)
    except Exception as e:
        log.exception("falha ao carregar dados")
        app.state.load_error = str(e)
    yield


app = FastAPI(title="Radar de Retenção", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    d = exc.detail
    if isinstance(d, dict) and "codigo" in d:
        return _erro(exc.status_code, d["codigo"], d.get("mensagem", ""))
    codigo = _CODIGOS.get(exc.status_code, "erro_interno" if exc.status_code >= 500 else "parametro_invalido")
    msg = d if isinstance(d, str) else "Requisição inválida."
    if exc.status_code == 404 and msg == "Not Found":
        msg = "Recurso não encontrado."
    return _erro(exc.status_code, codigo, msg)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    campos = ", ".join(
        ".".join(str(x) for x in e.get("loc", ()) if x not in ("query", "body", "path"))
        for e in exc.errors()
    )
    return _erro(422, "parametro_invalido", f"Parâmetro inválido: {campos}." if campos else "Parâmetro inválido.")


@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception):
    log.exception("erro interno")
    return _erro(500, "erro_interno", "Erro interno. Tente novamente em instantes.")


@app.get("/api/health")
def health():
    try:
        with psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=3) as conn:
            db = conn.execute("SELECT version()").fetchone()[0]
    except Exception:
        db = None
    carga_ok = getattr(app.state, "store", None) is not None
    return {
        "status": "ok" if (db and carga_ok) else "degradado",
        "db": db,
        "dados_carregados": carga_ok,
        "erro_carga": getattr(app.state, "load_error", None),
    }


for _r in ROUTERS:
    app.include_router(_r, prefix="/api")
