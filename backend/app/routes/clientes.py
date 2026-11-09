from typing import Literal, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import ai
from app.auth import current_user
from app.routes.deps import cliente_ou_404, get_store

router = APIRouter(tags=["clientes"])

Formato = Literal["ligacao", "email", "whatsapp"]


class AcaoIn(BaseModel):
    formato: Formato = "ligacao"


class ContatoIn(BaseModel):
    observacao: Optional[str] = None


def filtros_clientes(
    busca: Optional[str] = None,
    faixa: Optional[Literal["alto", "atencao", "saudavel"]] = None,
    perfil: Optional[Literal["silencioso", "frustrado", "travado", "saudavel"]] = None,
    porte: Optional[str] = None,
    setor: Optional[str] = None,
    cidade: Optional[str] = None,
    servico: Optional[str] = None,
) -> dict:
    return {
        "busca": busca, "faixa": faixa, "perfil": perfil, "porte": porte,
        "setor": setor, "cidade": cidade, "servico": servico,
    }


@router.get("/clientes")
def listar(
    filtros: dict = Depends(filtros_clientes),
    ordenar: Literal["prioridade", "score", "nome"] = "prioridade",
    direcao: Literal["desc", "asc"] = "desc",
    _: dict = Depends(current_user),
    store=Depends(get_store),
):
    itens = store.listar(ordenar=ordenar, direcao=direcao, **filtros)
    return {"total": len(itens), "itens": itens}


@router.get("/clientes/{cliente_id}")
def detalhe(cliente_id: str, _: dict = Depends(current_user), store=Depends(get_store)):
    cliente_ou_404(store, cliente_id)
    return store.cliente_detalhe(cliente_id)


@router.post("/clientes/{cliente_id}/acao")
def acao(cliente_id: str, body: Optional[AcaoIn] = None, _: dict = Depends(current_user),
         store=Depends(get_store)):
    cliente_ou_404(store, cliente_id)
    return ai.sugerir_acao(store, cliente_id, (body or AcaoIn()).formato)


@router.post("/clientes/{cliente_id}/acao/stream")
def acao_stream(cliente_id: str, body: Optional[AcaoIn] = None, _: dict = Depends(current_user),
                store=Depends(get_store)):
    cliente_ou_404(store, cliente_id)
    it = ai.sugerir_acao_stream(store, cliente_id, (body or AcaoIn()).formato)
    return StreamingResponse(it, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/clientes/{cliente_id}/contato")
def contato(cliente_id: str, body: Optional[ContatoIn] = None, usuario: dict = Depends(current_user),
            store=Depends(get_store)):
    cliente_ou_404(store, cliente_id)
    quando = store.marcar_contato(cliente_id, (body.observacao if body else None), usuario)
    return {"cliente_id": cliente_id, "contatado_em": quando.isoformat(timespec="seconds"), "contatado_por": usuario.get("nome")}
