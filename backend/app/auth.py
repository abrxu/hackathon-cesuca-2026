"""Autenticação: login (Postgres com fallback em memória), JWT HS256 e dependências."""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

log = logging.getLogger("radar.auth")

ALGORITHM = "HS256"
EXPIRA_HORAS = 12
_bearer = HTTPBearer(auto_error=False)

SEED_USUARIOS = [
    {"id": 1, "nome": "Ana Analista", "email": "analista@radar.local", "papel": "analista"},
    {"id": 2, "nome": "Gustavo Gestor", "email": "gestor@radar.local", "papel": "gestor"},
]
SEED_SENHA = "radar123"


def _secret() -> str:
    return os.environ.get("JWT_SECRET") or "dev-secret-change-me"


def _verificar_hash(senha: str, armazenado: str) -> bool:
    """Aceita 'pbkdf2_sha256$iter$salt$hash', 'salt$hash' e 'iter$salt$hash' (hex ou base64)."""
    try:
        partes = armazenado.split("$")
        iters = 260000
        if len(partes) == 4:
            iters, salt, h = int(partes[1]), partes[2], partes[3]
        elif len(partes) == 3:
            iters, salt, h = int(partes[0]), partes[1], partes[2]
        elif len(partes) == 2:
            salt, h = partes
        else:
            return False
        for iter_try in {iters, 260000, 100000, 120000, 600000, 10000}:
            for salt_b in _variantes(salt):
                calc = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt_b, iter_try)
                if hmac.compare_digest(calc.hex(), h) or hmac.compare_digest(
                    base64.b64encode(calc).decode(), h
                ):
                    return True
        return False
    except Exception:
        return False


def _variantes(salt: str):
    yield salt.encode()
    try:
        yield bytes.fromhex(salt)
    except ValueError:
        pass


def _buscar_no_banco(email: str, senha: str) -> dict | None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("sem DATABASE_URL")
    import psycopg

    with psycopg.connect(url, connect_timeout=3) as conn:
        row = conn.execute(
            "SELECT id, nome, papel, senha_hash FROM usuarios WHERE lower(email) = lower(%s)",
            (email,),
        ).fetchone()
    if row and _verificar_hash(senha, str(row[3])):
        return {"id": row[0], "nome": row[1], "papel": row[2]}
    return None


def _buscar_seed(email: str, senha: str) -> dict | None:
    for u in SEED_USUARIOS:
        if u["email"].lower() == email.lower() and hmac.compare_digest(senha, SEED_SENHA):
            return {"id": u["id"], "nome": u["nome"], "papel": u["papel"]}
    return None


def gerar_token(usuario: dict) -> str:
    agora = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario["id"]),
        "nome": usuario["nome"],
        "papel": usuario["papel"],
        "iat": agora,
        "exp": agora + timedelta(hours=EXPIRA_HORAS),
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def login(email: str, senha: str) -> dict | None:
    usuario = None
    try:
        usuario = _buscar_no_banco(email, senha)
    except Exception as e:
        log.warning("login via banco falhou, usando seed em memória: %s", e)
    if usuario is None:
        usuario = _buscar_seed(email, senha)
    if usuario is None:
        return None
    return {"token": gerar_token(usuario), "usuario": usuario}


def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> dict:
    if cred is None or not cred.credentials:
        raise HTTPException(401, detail={"codigo": "nao_autenticado", "mensagem": "Entre para continuar."})
    try:
        p = jwt.decode(cred.credentials, _secret(), algorithms=[ALGORITHM])
        try:
            uid = int(p["sub"])
        except ValueError:
            uid = p["sub"]
        return {"id": uid, "nome": p["nome"], "papel": p["papel"]}
    except Exception:
        raise HTTPException(
            401, detail={"codigo": "nao_autenticado", "mensagem": "Sessão expirada. Entre novamente."}
        )


def require_role(papel: str):
    def dep(user: dict = Depends(current_user)) -> dict:
        if user["papel"] != papel:
            raise HTTPException(
                403,
                detail={
                    "codigo": "nao_autorizado",
                    "mensagem": "Você não tem permissão para acessar este recurso.",
                },
            )
        return user

    return dep
