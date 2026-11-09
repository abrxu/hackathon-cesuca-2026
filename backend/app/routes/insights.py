from fastapi import APIRouter, Depends

from app import scoring
from app.auth import require_role
from app.routes.deps import get_store

router = APIRouter(tags=["insights"])


@router.get("/insights/produto")
def produto(_: dict = Depends(require_role("gestor")), store=Depends(get_store)):
    return {"itens": scoring.insights_produto(store.ds)}
