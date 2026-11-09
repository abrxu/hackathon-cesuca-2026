from typing import Literal

from fastapi import APIRouter, Depends, Response

from app import reports
from app.auth import require_role
from app.routes.clientes import filtros_clientes
from app.routes.deps import get_store

router = APIRouter(tags=["relatorios"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF = "application/pdf"


def _arquivo(conteudo: bytes, nome: str, media: str) -> Response:
    return Response(
        content=conteudo,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )


@router.get("/relatorios/analista.{ext}")
def analista(
    ext: Literal["xlsx", "pdf"],
    filtros: dict = Depends(filtros_clientes),
    _: dict = Depends(require_role("analista")),
    store=Depends(get_store),
):
    filtros = {k: v for k, v in filtros.items() if v is not None}
    if ext == "xlsx":
        return _arquivo(reports.relatorio_analista_xlsx(store, filtros), "relatorio-analista.xlsx", XLSX)
    return _arquivo(reports.relatorio_analista_pdf(store, filtros), "relatorio-analista.pdf", PDF)


@router.get("/relatorios/gestor.{ext}")
def gestor(
    ext: Literal["xlsx", "pdf"],
    _: dict = Depends(require_role("gestor")),
    store=Depends(get_store),
):
    if ext == "xlsx":
        return _arquivo(reports.relatorio_gestor_xlsx(store), "relatorio-gestor.xlsx", XLSX)
    return _arquivo(reports.relatorio_gestor_pdf(store), "relatorio-gestor.pdf", PDF)
