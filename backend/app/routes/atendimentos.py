from typing import Literal, Optional

from fastapi import APIRouter, Depends

from app.auth import current_user
from app.routes.deps import get_store

router = APIRouter(tags=["atendimentos"])


@router.get("/atendimentos/fila")
def fila(
    ordem: Literal["inteligente", "chegada"] = "inteligente",
    servico: Optional[str] = None,
    assunto: Optional[str] = None,
    canal: Optional[str] = None,
    _: dict = Depends(current_user),
    store=Depends(get_store),
):
    itens = store.fila(ordem, servico=servico, assunto=assunto, canal=canal)
    return {"total": len(itens), "itens": itens}
