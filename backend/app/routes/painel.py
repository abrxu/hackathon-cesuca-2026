from fastapi import APIRouter, Depends

from app.auth import current_user
from app.routes.deps import get_store

router = APIRouter(tags=["painel"])


@router.get("/painel")
def painel(_: dict = Depends(current_user), store=Depends(get_store)):
    return store.painel()
