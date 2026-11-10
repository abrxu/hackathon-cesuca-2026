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
from reportlab.lib.styles import ParagraphStyle
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


# ---- PDF: mesma identidade visual do sistema (tokens de frontend/src/index.css) ----
INK = colors.HexColor("#0F172A")
CANVAS = colors.HexColor("#F8FAFC")
SURFACE = colors.HexColor("#FDFEFF")
RISCO_ALTO = colors.HexColor("#DC2626")
RISCO_ATENCAO = colors.HexColor("#D97706")
RISCO_SAUDAVEL = colors.HexColor("#059669")
IA = colors.HexColor("#4F46E5")


def _mix(cor, pct, base=SURFACE):
    """Equivale ao color-mix(in srgb, cor pct%, base) do CSS."""
    p = pct / 100
    return colors.Color(cor.red * p + base.red * (1 - p), cor.green * p + base.green * (1 - p),
                        cor.blue * p + base.blue * (1 - p))


INK_FAINT = _mix(INK, 64, CANVAS)
LINE = _mix(INK, 20, CANVAS)
ALTO_SOFT, ATENCAO_SOFT, SAUDAVEL_SOFT = _mix(RISCO_ALTO, 10), _mix(RISCO_ATENCAO, 12), _mix(RISCO_SAUDAVEL, 10)
IA_SOFT = _mix(IA, 7)
FAIXA_LABEL = {"alto": "Alto risco", "atencao": "Atenção", "saudavel": "Saudável"}
PERFIL_LABEL = {"silencioso": "Silencioso", "frustrado": "Frustrado", "travado": "Travado", "saudavel": "Saudável"}
FONT, FONT_B = "Helvetica", "Helvetica-Bold"


def _estilos():
    def st(nome, **kw):
        return ParagraphStyle(nome, fontName=kw.pop("fontName", FONT), textColor=kw.pop("textColor", INK), **kw)

    return {
        "titulo": st("titulo", fontName=FONT_B, fontSize=22, leading=26, spaceAfter=2),
        "meta": st("meta", fontSize=9, leading=12, textColor=INK_FAINT),
        "h2": st("h2", fontName=FONT_B, fontSize=13, leading=16, spaceBefore=14, spaceAfter=6, keepWithNext=1),
        "corpo": st("corpo", fontSize=10, leading=14),
        "cel": st("cel", fontSize=7.5, leading=9.5),
        "cel_b": st("cel_b", fontName=FONT_B, fontSize=7.5, leading=9.5),
        "cab": st("cab", fontName=FONT_B, fontSize=7.5, leading=9.5, textColor=CANVAS),
        "kpi_n": st("kpi_n", fontName=FONT_B, fontSize=22, leading=24, alignment=1),
        "kpi_r": st("kpi_r", fontSize=7.5, leading=9.5, textColor=INK_FAINT, alignment=1),
    }


def _esc(x) -> str:
    return str(_v(x)).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _cell(x, st):
    return Paragraph(_esc(x), st)


def _tabela_pdf(cab, linhas, widths, est, faixa_col=None, faixas=None, bold_cols=()):
    """Tabela no estilo do sistema: cabeçalho azul-noite, linhas claras com divisória fina.
    faixa_col/faixas pintam a coluna da faixa como a pílula de risco da interface."""
    data = [[_cell(c, est["cab"]) for c in cab]]
    for r in linhas:
        data.append([_cell(v, est["cel_b"] if j in bold_cols else est["cel"]) for j, v in enumerate(r)])
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [SURFACE, CANVAS]),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if faixa_col is not None and faixas:
        for i, f in enumerate(faixas, 1):
            if f == "alto":  # vermelho sólido, texto claro (AA)
                cmds.append(("BACKGROUND", (faixa_col, i), (faixa_col, i), RISCO_ALTO))
                data[i][faixa_col] = Paragraph(_esc(FAIXA_LABEL["alto"]),
                                               ParagraphStyle("fa", parent=est["cel_b"], textColor=colors.white))
            else:  # fundo suave + texto azul-noite
                soft = ATENCAO_SOFT if f == "atencao" else SAUDAVEL_SOFT
                cor = RISCO_ATENCAO if f == "atencao" else RISCO_SAUDAVEL
                cmds += [("BACKGROUND", (faixa_col, i), (faixa_col, i), soft),
                         ("LINEBEFORE", (faixa_col, i), (faixa_col, i), 2.5, cor)]
                data[i][faixa_col] = _cell(FAIXA_LABEL.get(f, f), est["cel_b"])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle(cmds))
    return t


def _decorar(canvas, doc):
    """Faixa de marca no topo e rodapé com paginação, em todas as páginas."""
    w, h = doc.pagesize
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, h - 0.9 * cm, w, 0.9 * cm, stroke=0, fill=1)
    canvas.setFillColor(CANVAS)
    canvas.setFont(FONT_B, 9)
    canvas.drawString(1.5 * cm, h - 0.58 * cm, "Radar de Clientes")
    canvas.setFont(FONT, 8)
    canvas.drawRightString(w - 1.5 * cm, h - 0.58 * cm, "Customer Success")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(1.5 * cm, 1.1 * cm, w - 1.5 * cm, 1.1 * cm)
    canvas.setFillColor(INK_FAINT)
    canvas.setFont(FONT, 8)
    canvas.drawString(1.5 * cm, 0.7 * cm, f"Gerado em {datetime.now():%d/%m/%Y %H:%M}")
    canvas.drawRightString(w - 1.5 * cm, 0.7 * cm, f"Página {doc.page}")
    canvas.restoreState()


def _pdf(story, pagesize, titulo="Relatório") -> bytes:
    b = io.BytesIO()
    doc = SimpleDocTemplate(b, pagesize=pagesize, leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=2.0 * cm,
                            bottomMargin=1.8 * cm, title=titulo, author="Radar de Clientes")
    doc.build(story, onFirstPage=_decorar, onLaterPages=_decorar)
    return b.getvalue()


def relatorio_analista_pdf(store, filtros: dict) -> bytes:
    cab, rows = _linhas_analista(store, filtros)
    est = _estilos()
    story = [Paragraph("Relatório do analista", est["titulo"]),
             Paragraph(f"Carteira e riscos | {len(rows)} clientes", est["meta"]), Spacer(1, 10)]
    pdf_cab = ["Cliente", "Cidade", "Score", "Faixa", "Perfil", "Engajamento", "Atrito", "Satisfação",
               "Motivo principal", "Contatado em"]
    idx = [cab.index(c) for c in pdf_cab]
    linhas = []
    for r in rows:
        l = [r[i] for i in idx]
        l[4] = PERFIL_LABEL.get(l[4], l[4])
        linhas.append(l)
    widths = [4.6 * cm, 2.4 * cm, 1.4 * cm, 2.3 * cm, 2.2 * cm, 2.1 * cm, 1.6 * cm, 2.0 * cm, 5.0 * cm, 3.1 * cm]
    if linhas:
        story.append(_tabela_pdf(pdf_cab, linhas, widths, est, faixa_col=3,
                                 faixas=[r[cab.index("Faixa")] for r in rows], bold_cols=(0, 2)))
    else:
        story.append(Paragraph("Nenhum cliente para os filtros selecionados.", est["corpo"]))
    return _pdf(story, landscape(A4), "Relatório do analista")


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


def _kpis_pdf(k, est, largura):
    itens = [("Clientes em alto risco", k.get("clientes_alto_risco"), RISCO_ALTO),
             ("Atendimentos pendentes", k.get("atendimentos_pendentes"), INK),
             ("Pendentes de prioridade alta", k.get("pendentes_prioridade_alta"), INK),
             ("Satisfação média", k.get("satisfacao_media"), INK),
             ("Tempo médio de resolução (min)", k.get("tempo_medio_resolucao_min"), INK)]
    cel = [[[Paragraph(_esc(v), ParagraphStyle("kn", parent=est["kpi_n"], textColor=cor)),
             Paragraph(n, est["kpi_r"])] for n, v, cor in itens]]
    t = Table(cel, colWidths=[largura / len(itens)] * len(itens))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CANVAS), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def relatorio_gestor_pdf(store) -> bytes:
    p, top, ins, resumo = _dados_gestor(store)
    k = p.get("kpis", {})
    est = _estilos()
    larg = 18 * cm
    # Resumo executivo: caixa na cor da IA, como o copiloto na interface.
    caixa = Table([[Paragraph(_esc(resumo), est["corpo"])]], colWidths=[larg])
    caixa.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), IA_SOFT), ("LINEBEFORE", (0, 0), (0, -1), 3, IA),
                               ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                               ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    dist = [[FAIXA_LABEL.get(a, a), b] for a, b in (p.get("distribuicao") or {}).items()]
    perf = [[PERFIL_LABEL.get(a, a), b] for a, b in (p.get("perfis") or {}).items()]
    lado = Table([[_tabela_pdf(["Faixa", "Clientes"], dist, [5 * cm, 3.5 * cm], est),
                   _tabela_pdf(["Perfil", "Clientes"], perf, [5 * cm, 3.5 * cm], est)]], colWidths=[9 * cm, 9 * cm])
    lado.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (0, 0), 6), ("RIGHTPADDING", (1, 0), (1, 0), 0)]))
    story = [Paragraph("Relatório do gestor", est["titulo"]),
             Paragraph("Visão para a diretoria", est["meta"]), Spacer(1, 10),
             Paragraph("Resumo executivo", est["h2"]), caixa,
             Paragraph("Indicadores", est["h2"]), _kpis_pdf(k, est, larg),
             Paragraph("Distribuição por faixa e perfil", est["h2"]), lado,
             Paragraph("Top 10 clientes em risco", est["h2"])]
    if top:
        story.append(_tabela_pdf(["Cliente", "Score", "Perfil", "Motivo"],
                                 [[i.get("nome"), i.get("score"), PERFIL_LABEL.get(i.get("perfil"), i.get("perfil")),
                                   i.get("motivo_principal")] for i in top],
                                 [5 * cm, 1.5 * cm, 2.5 * cm, 9 * cm], est, bold_cols=(0, 1)))
    else:
        story.append(Paragraph("Nenhum cliente em alto risco.", est["corpo"]))
    story.append(Paragraph("Insights de produto", est["h2"]))
    if ins:
        story.append(_tabela_pdf(["Serviço", "Assunto", "Atend.", "Descrição"],
                                 [[i.get("servico"), i.get("assunto"), i.get("atendimentos"), i.get("descricao")]
                                  for i in ins[:8]], [3 * cm, 3 * cm, 1.5 * cm, 10.5 * cm], est, bold_cols=(0,)))
    else:
        story.append(Paragraph("Sem concentração relevante de problemas por serviço.", est["corpo"]))
    return _pdf(story, A4, "Relatório do gestor")
