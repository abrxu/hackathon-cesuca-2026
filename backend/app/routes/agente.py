from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app import ai
from app.auth import current_user
from app.routes.deps import get_store

router = APIRouter(tags=["agente"])


class PerguntaIn(BaseModel):
    pergunta: str = Field(min_length=1, max_length=2000)


@router.post("/agente/perguntar")
def perguntar(body: PerguntaIn, user: dict = Depends(current_user), store=Depends(get_store)):
    return ai.perguntar(store, body.pergunta, user["papel"])


@router.post("/agente/perguntar/stream")
def perguntar_stream(body: PerguntaIn, user: dict = Depends(current_user), store=Depends(get_store)):
    it = ai.perguntar_stream(store, body.pergunta, user["papel"])
    return StreamingResponse(it, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
