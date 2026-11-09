from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import auth as auth_mod

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    email: str
    senha: str


@router.post("/auth/login")
def login(body: LoginIn):
    res = auth_mod.login(body.email.strip(), body.senha)
    if res is None:
        raise HTTPException(
            401, detail={"codigo": "nao_autenticado", "mensagem": "E-mail ou senha incorretos."}
        )
    return res


@router.get("/me")
def me(user: dict = Depends(auth_mod.current_user)):
    return user
