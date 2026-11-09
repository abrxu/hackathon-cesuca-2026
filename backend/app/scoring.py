"""Score de risco por cliente: 3 facetas (engajamento, atrito, satisfação)."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from .data import Atendimento, Cliente, Dataset


@dataclass
class Faceta:
    nota: int
    peso: float
    contribuicao: int
    descricao: str


@dataclass
class ClienteRisco:
    cliente_id: str
    score: int
    faixa: str
    perfil: str
    facetas: dict[str, Faceta]
    motivo_principal: str
    uso_total: list[dict]
    pendentes: int
    pendentes_alta: int
    satisfacao_media: float | None
    sinais: list[str] = field(default_factory=list)
    meses_de_casa: int = 0


PESOS = {"engajamento": 0.40, "atrito": 0.35, "satisfacao": 0.25}
IMPACTO = {"Micro": 1, "Pequena": 2, "Média": 3}

# Calibração das notas
QUEDA_MAX = 0.28      # queda ponderada que já vale nota 100 de engajamento
ATRITO_PEND = 50      # pontos por atendimento pendente
ATRITO_ALTA = 35      # pontos extras por pendente de prioridade alta
ATRITO_VOLUME = 8     # pontos por atendimento além do 2º
NOTA_NEUTRA = 40      # satisfação sem avaliações


def faixa_de(score: int) -> str:
    if score >= 70:
        return "alto"
    if score >= 40:
        return "atencao"
    return "saudavel"


def prioridade_key(r: ClienteRisco, c: Cliente) -> tuple:
    return (-r.score, -IMPACTO.get(c.porte, 1))


def _clamp(x: float) -> int:
    return int(max(0, min(100, round(x))))


def _pct(x: float) -> int:
    return int(round(abs(x) * 100))


def _uso_total(ds_uso) -> list[dict]:
    por_mes: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for u in ds_uso:
        por_mes[u.mes][0] += u.acessos
        por_mes[u.mes][1] += u.operacoes
    return [{"mes": m, "acessos": v[0], "operacoes": v[1]} for m, v in sorted(por_mes.items())]


def _engajamento(uso_total: list[dict]) -> tuple[int, str, float, float]:
    """Retorna nota, descrição, queda_ops, queda_acessos (fração; positiva = queda)."""
    if len(uso_total) < 2:
        return 0, "Sem dados de uso suficientes para comparar os meses", 0.0, 0.0
    a, b = uso_total[0], uso_total[-1]

    def queda(i, f):
        return (i - f) / i if i > 0 else 0.0

    qo, qa = queda(a["operacoes"], b["operacoes"]), queda(a["acessos"], b["acessos"])
    ponderada = 0.6 * qo + 0.4 * qa
    nota = _clamp(100 * max(0.0, ponderada) / QUEDA_MAX)
    m1, m2 = a["mes"], b["mes"]
    if ponderada <= 0:
        desc = f"Uso estável ou em alta entre {m1} e {m2}"
    else:
        desc = f"Operações caíram {_pct(qo)}% e acessos {_pct(qa)}% entre {m1} e {m2}" \
            if qo > 0 and qa > 0 else (
            f"Operações caíram {_pct(qo)}% entre {m1} e {m2}" if qo > 0
            else f"Acessos caíram {_pct(qa)}% entre {m1} e {m2}")
    return nota, desc, qo, qa


def _meses(mes_ref: str) -> str:
    return mes_ref


def compute_all(ds: Dataset) -> dict[str, ClienteRisco]:
    ref = max((a.data_abertura for a in ds.atendimentos), default=datetime.now())
    por_cli_uso = defaultdict(list)
    for u in ds.uso:
        por_cli_uso[u.cliente_id].append(u)
    por_cli_at: dict[str, list[Atendimento]] = defaultdict(list)
    for a in ds.atendimentos:
        por_cli_at[a.cliente_id].append(a)

    out: dict[str, ClienteRisco] = {}
    for cid, c in ds.clientes.items():
        ats = sorted(por_cli_at.get(cid, []), key=lambda a: a.data_abertura)
        uso_total = _uso_total(por_cli_uso.get(cid, []))

        # Engajamento
        n_eng, d_eng, qo, qa = _engajamento(uso_total)

        # Atrito
        pend = [a for a in ats if a.status == "Pendente"]
        pend_alta = [a for a in pend if a.prioridade == "Alta"]
        n_atr = _clamp(ATRITO_PEND * len(pend) + ATRITO_ALTA * len(pend_alta)
                       + ATRITO_VOLUME * max(0, len(ats) - 2))
        if not ats:
            d_atr = "Nenhum atendimento aberto"
        else:
            d_atr = f"{len(pend)} pendente{'s' if len(pend) != 1 else ''}"
            if pend_alta:
                d_atr += f", {len(pend_alta)} de prioridade alta"
            d_atr += f"; {len(ats)} atendimento{'s' if len(ats) != 1 else ''} no total"

        # Satisfação
        notas = [a.satisfacao for a in ats if a.satisfacao is not None]
        sat_media = round(sum(notas) / len(notas), 2) if notas else None
        if sat_media is None:
            n_sat = NOTA_NEUTRA
            d_sat = "Sem notas de satisfação; nota neutra aplicada"
        else:
            n_sat = _clamp((5 - sat_media) / 2.5 * 100)
            d_sat = f"Nota média {str(round(sat_media, 1)).replace('.', ',')} em {len(notas)} avaliaç{'ões' if len(notas) != 1 else 'ão'}"

        notas_f = {"engajamento": n_eng, "atrito": n_atr, "satisfacao": n_sat}
        descs = {"engajamento": d_eng, "atrito": d_atr, "satisfacao": d_sat}
        contribs = {k: int(round(notas_f[k] * PESOS[k])) for k in PESOS}
        score = _clamp(sum(notas_f[k] * PESOS[k] for k in PESOS))
        # ajusta a maior contribuição para a soma bater exatamente com o score
        diff = score - sum(contribs.values())
        if diff:
            kmax = max(contribs, key=lambda k: notas_f[k] * PESOS[k])
            contribs[kmax] += diff
        facetas = {k: Faceta(notas_f[k], PESOS[k], contribs[k], descs[k]) for k in PESOS}

        # Motivo principal: faceta com maior contribuição
        kmain = max(contribs, key=lambda k: contribs[k])
        if score < 40 and contribs[kmain] < 15:
            motivo = "Sem sinais relevantes de risco"
        elif kmain == "engajamento":
            if qo > 0:
                motivo = f"Operações caíram {_pct(qo)}% desde julho"
            elif qa > 0:
                motivo = f"Acessos caíram {_pct(qa)}% desde julho"
            else:
                motivo = "Uso em queda desde julho"
        elif kmain == "atrito":
            motivo = f"{len(pend)} atendimento{'s' if len(pend) != 1 else ''} pendente{'s' if len(pend) != 1 else ''}" \
                + (f", {len(pend_alta)} de prioridade alta" if pend_alta else "")
        else:
            motivo = f"Satisfação baixa (média {str(round(sat_media, 1)).replace('.', ',')})" \
                if sat_media is not None else "Sem avaliações de satisfação"

        # Sinais de contexto
        meses_casa = max(0, (ref.year - c.data_cadastro.year) * 12 + ref.month - c.data_cadastro.month
                         - (1 if ref.day < c.data_cadastro.day else 0))
        sinais: list[str] = []
        if meses_casa < 6:
            sinais.append("cliente_recente")
        cont: dict[str, int] = defaultdict(int)
        for a in ats:
            if a.assunto:
                cont[a.assunto] += 1
        for assunto, n in sorted(cont.items()):
            if n >= 2:
                sinais.append(f"assunto_recorrente:{assunto}")

        out[cid] = ClienteRisco(
            cliente_id=cid, score=score, faixa=faixa_de(score), perfil="saudavel",
            facetas=facetas, motivo_principal=motivo, uso_total=uso_total,
            pendentes=len(pend), pendentes_alta=len(pend_alta), satisfacao_media=sat_media,
            sinais=sinais, meses_de_casa=meses_casa,
        )
    return out


def insights_produto(ds: Dataset) -> list[dict]:
    """Concentração de problemas por (serviço, assunto); só para o gestor."""
    total_assunto: dict[str, int] = defaultdict(int)
    grupos: dict[tuple[str, str], list[Atendimento]] = defaultdict(list)
    for a in ds.atendimentos:
        total_assunto[a.assunto] += 1
        grupos[(a.servico, a.assunto)].append(a)
    itens = []
    for (serv, ass), ats in grupos.items():
        if len(ats) < 3:
            continue
        notas = [a.satisfacao for a in ats if a.satisfacao is not None]
        share = len(ats) / total_assunto[ass]
        itens.append({
            "servico": serv, "assunto": ass, "atendimentos": len(ats),
            "satisfacao_media": round(sum(notas) / len(notas), 1) if notas else None,
            "clientes_afetados": len({a.cliente_id for a in ats}),
            "descricao": f"{serv} concentra {round(share * 100)}% dos atendimentos de {ass.lower()}",
            "_share": share,
        })
    itens.sort(key=lambda i: (-i["_share"], -i["atendimentos"]))
    for i in itens:
        i.pop("_share")
    return itens[:8]


def prioridade_sugerida(at: Atendimento, r: ClienteRisco, ref: datetime) -> tuple[str, str]:
    dias = max(0, (ref - at.data_abertura).days)
    if r.faixa == "alto":
        return "Crítica", "Cliente em alto risco"
    if at.prioridade == "Alta" and r.faixa == "atencao":
        return "Crítica", "Prioridade alta de cliente em atenção"
    if at.prioridade == "Alta":
        return "Alta", "Prioridade alta informada no atendimento"
    if dias >= 20:
        return "Alta", f"Aberto há {dias} dias sem resolução"
    if r.faixa == "atencao":
        return "Alta", "Cliente em atenção"
    if at.prioridade == "Baixa" and dias < 10:
        return "Normal", "Prioridade baixa e aberto recentemente"
    return "Normal", "Sem agravantes"
