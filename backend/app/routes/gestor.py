from fastapi import APIRouter, Depends

from app.auth import require_role
from app.routes.deps import get_store

router = APIRouter(tags=["gestor"])


@router.get("/gestor/visao")
def visao(_: dict = Depends(require_role("gestor")), store=Depends(get_store)):
    return store.visao_gestor()
