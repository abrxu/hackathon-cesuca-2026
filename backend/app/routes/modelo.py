from fastapi import APIRouter, Depends

from app import ml
from app.auth import current_user

router = APIRouter(tags=["modelo"])


@router.get("/modelo/churn-simulado")
def churn_simulado(_: dict = Depends(current_user)):
    try:
        info = ml.churn_sim_info()
    except Exception:
        info = None
    if not info:
        return {"disponivel": False, "amostras": None, "acuracia": None, "coeficientes": None}
    return {"disponivel": True, **info}
