"""Relatórios em xlsx (openpyxl) e pdf (reportlab). Retornam bytes."""
from __future__ import annotations

import io
import logging
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app import ai

log = logging.getLogger("radar.reports")
HEAD_FILL = PatternFill("solid", fgColor="1F2937")
HEAD_FONT = Font(bold=True, color="FFFFFF")


def _v(x):
    return "—" if x is None else x


def _fmt_dt(x):
    if not x:
        return "—"
    return x.strftime("%d/%m/%Y %H:%M") if hasattr(x, "strftime") else str(x)[:16].replace("T", " ")


def _facetas(item: dict, store) -> dict:
    f = item.get("facetas")
    if f:
        return f
    try:
        return store.cliente_detalhe(item["cliente_id"]).get("facetas", {})
    except Exception:  # noqa: BLE001
        return {}


def _linhas_analista(store, filtros: dict):
    filtros = {k: v for k, v in (filtros or {}).items() if v}
    cab = ["Cliente", "Porte", "Setor", "Cidade", "Score", "Faixa", "Perfil", "Engajamento", "Atrito", "Satisfação",
           "Motivo principal", "Contatado em"]
    rows = []
    for i in store.listar(**filtros):
        fa = _facetas(i, store)
        nota = lambda k: fa.get(k, {}).get("nota", "—") if isinstance(fa.get(k), dict) else "—"  # noqa: E731
        rows.append([i.get("nome"), i.get("porte"), i.get("setor"), i.get("cidade"), i.get("score"), i.get("faixa"),
                     i.get("perfil"), nota("engajamento"), nota("atrito"), nota("satisfacao"),
                     i.get("motivo_principal"), _fmt_dt(i.get("contatado_em"))])
    return cab, rows


def _dados_gestor(store):
    p = store.painel()
    top = store.listar(faixa="alto")[:10]
    try:
        from app import scoring

        ins = scoring.insights_produto(store.ds)
    except Exception:  # noqa: BLE001
        ins = []
    return p, top, ins, ai.resumo_executivo(store)


def _sheet(ws, cab, rows, start=1):
    for j, c in enumerate(cab, 1):
        cell = ws.cell(row=start, column=j, value=c)
        cell.fill, cell.font = HEAD_FILL, HEAD_FONT
    for r, row in enumerate(rows, start + 1):
        for j, v in enumerate(row, 1):
            ws.cell(row=r, column=j, value=_v(v))
    for j in range(1, len(cab) + 1):
        w = max([len(str(cab[j - 1]))] + [len(str(r[j - 1])) for r in rows if j - 1 < len(r)]) + 2
        ws.column_dimensions[get_column_letter(j)].width = min(w, 60)


def _bytes_wb(wb) -> bytes:
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def relatorio_analista_xlsx(store, filtros: dict) -> bytes:
    cab, rows = _linhas_analista(store, filtros)
    wb = Workbook()
    ws = wb.active
    ws.title = "Carteira"
    _sheet(ws, cab, rows)
    ws.freeze_panes = "A2"
    return _bytes_wb(wb)


def _tabela_pdf(data, widths=None, fs=7):
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2937")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), fs), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D1D5DB")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _cell(x, st):
    return Paragraph(str(_v(x)).replace("&", "&amp;").replace("<", "&lt;"), st)


def _pdf(story, pagesize) -> bytes:
    b = io.BytesIO()
    SimpleDocTemplate(b, pagesize=pagesize, leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.5 * cm,
                      bottomMargin=1.5 * cm, title="Relatório").build(story)
    return b.getvalue()


def relatorio_analista_pdf(store, filtros: dict) -> bytes:
    cab, rows = _linhas_analista(store, filtros)
    ss = getSampleStyleSheet()
    small = ss["BodyText"].clone("small", fontSize=7, leading=8.5)
    story = [Paragraph("Relatório do analista: carteira e riscos", ss["Title"]),
             Paragraph(f"Gerado em {datetime.now():%d/%m/%Y %H:%M} | {len(rows)} clientes", ss["BodyText"]), Spacer(1, 8)]
    pdf_cab = [c for c in cab if c not in ("Setor", "Porte")]
    idx = [cab.index(c) for c in pdf_cab]
    data = [pdf_cab] + [[_cell(r[i], small) for i in idx] for r in rows]
    story.append(_tabela_pdf(data))
    return _pdf(story, landscape(A4))


def relatorio_gestor_xlsx(store) -> bytes:
    p, top, ins, resumo = _dados_gestor(store)
    k = p.get("kpis", {})
    wb = Workbook()
    ws = wb.active
    ws.title = "Resumo"
    ws["A1"], ws["A1"].font = "Relatório do gestor", Font(bold=True, size=14)
    ws["A3"] = resumo
    ws["A3"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells("A3:D8")
    kp = [[n, k.get(c)] for n, c in [("Clientes em alto risco", "clientes_alto_risco"), ("Atendimentos pendentes", "atendimentos_pendentes"),
          ("Pendentes de prioridade alta", "pendentes_prioridade_alta"), ("Satisfação média", "satisfacao_media"),
          ("Tempo médio de resolução (min)", "tempo_medio_resolucao_min")]]
    _sheet(ws, ["Indicador", "Valor"], kp, start=10)
    ws.column_dimensions["A"].width = 40
    ws.column_dimensions["B"].width = 16
    ws2 = wb.create_sheet("Distribuição")
    _sheet(ws2, ["Faixa", "Clientes"], [[a, b] for a, b in (p.get("distribuicao") or {}).items()])
    _sheet(ws2, ["Perfil", "Clientes"], [[a, b] for a, b in (p.get("perfis") or {}).items()], start=len(p.get("distribuicao") or {}) + 4)
    ws3 = wb.create_sheet("Top 10 em risco")
    _sheet(ws3, ["Cliente", "Porte", "Score", "Perfil", "Motivo principal"],
           [[i.get("nome"), i.get("porte"), i.get("score"), i.get("perfil"), i.get("motivo_principal")] for i in top])
    ws4 = wb.create_sheet("Insights de produto")
    _sheet(ws4, ["Serviço", "Assunto", "Atendimentos", "Satisfação média", "Clientes afetados", "Descrição"],
           [[i.get("servico"), i.get("assunto"), i.get("atendimentos"), i.get("satisfacao_media"), i.get("clientes_afetados"),
             i.get("descricao")] for i in ins])
    return _bytes_wb(wb)


def relatorio_gestor_pdf(store) -> bytes:
    p, top, ins, resumo = _dados_gestor(store)
    k = p.get("kpis", {})
    ss = getSampleStyleSheet()
    small = ss["BodyText"].clone("small", fontSize=8, leading=10)
    story = [Paragraph("Relatório do gestor", ss["Title"]),
             Paragraph(f"Gerado em {datetime.now():%d/%m/%Y %H:%M}", ss["BodyText"]), Spacer(1, 8),
             Paragraph("Resumo executivo", ss["Heading2"]), Paragraph(resumo, ss["BodyText"]), Spacer(1, 8),
             Paragraph("Indicadores", ss["Heading2"]),
             _tabela_pdf([["Indicador", "Valor"],
                          ["Clientes em alto risco", _v(k.get("clientes_alto_risco"))],
                          ["Atendimentos pendentes", _v(k.get("atendimentos_pendentes"))],
                          ["Pendentes de prioridade alta", _v(k.get("pendentes_prioridade_alta"))],
                          ["Satisfação média", _v(k.get("satisfacao_media"))],
                          ["Tempo médio de resolução (min)", _v(k.get("tempo_medio_resolucao_min"))]], [9 * cm, 4 * cm], 9),
             Spacer(1, 8), Paragraph("Distribuição por faixa e perfil", ss["Heading2"]),
             _tabela_pdf([["Faixa", "Clientes"]] + [[a, b] for a, b in (p.get("distribuicao") or {}).items()], [9 * cm, 4 * cm], 9),
             Spacer(1, 4),
             _tabela_pdf([["Perfil", "Clientes"]] + [[a, b] for a, b in (p.get("perfis") or {}).items()], [9 * cm, 4 * cm], 9),
             Spacer(1, 8), Paragraph("Top 10 clientes em risco", ss["Heading2"]),
             _tabela_pdf([["Cliente", "Score", "Perfil", "Motivo"]] +
                         [[_cell(i.get("nome"), small), _v(i.get("score")), _v(i.get("perfil")), _cell(i.get("motivo_principal"), small)] for i in top],
                         [5 * cm, 1.5 * cm, 2.5 * cm, 8 * cm], 8),
             Spacer(1, 8), Paragraph("Insights de produto", ss["Heading2"])]
    if ins:
        story.append(_tabela_pdf([["Serviço", "Assunto", "Atend.", "Descrição"]] +
                                 [[_cell(i.get("servico"), small), _cell(i.get("assunto"), small), _v(i.get("atendimentos")),
                                   _cell(i.get("descricao"), small)] for i in ins[:8]], [3 * cm, 3 * cm, 1.5 * cm, 9.5 * cm], 8))
    else:
        story.append(Paragraph("Sem concentração relevante de problemas por serviço.", ss["BodyText"]))
    return _pdf(story, A4)
