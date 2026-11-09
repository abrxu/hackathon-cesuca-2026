"""Store: estado em memória lido pelas rotas (dataset + riscos + contatos)."""
from __future__ import annotations

import logging
import os
import unicodedata
from datetime import datetime

from app import scoring

log = logging.getLogger("radar.store")

PORTE_ORDEM = {"Micro": 1, "Pequena": 2, "Média": 3}


def _norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def _iso(dt) -> str | None:
    return dt.isoformat(timespec="seconds") if dt else None


def _facetas_dict(r) -> dict:
    out = {}
    for k, f in (r.facetas or {}).items():
        out[k] = {
            "nota": f.nota,
            "peso": f.peso,
            "contribuicao": f.contribuicao,
            "descricao": f.descricao,
        }
    return out


def _num(v):
    return None if v is None else v


class Store:
    def __init__(self, ds, riscos, database_url: str | None = None):
        self.ds = ds
        self.riscos = riscos
        self.database_url = database_url if database_url is not None else os.environ.get("DATABASE_URL")
        self.contatos: dict[str, datetime] = {}
        self.ref = max((a.data_abertura for a in ds.atendimentos if a.data_abertura), default=datetime.now())
        self._at_por_cliente: dict[str, list] = {}
        for a in ds.atendimentos:
            self._at_por_cliente.setdefault(a.cliente_id, []).append(a)
        for lst in self._at_por_cliente.values():
            lst.sort(key=lambda a: a.data_abertura or datetime.min, reverse=True)

    # ---------- serialização ----------
    @staticmethod
    def atendimento_dict(a) -> dict:
        return {
            "atendimento_id": a.atendimento_id,
            "cliente_id": a.cliente_id,
            "data_abertura": _iso(a.data_abertura),
            "servico": a.servico,
            "assunto": a.assunto,
            "canal": a.canal,
            "prioridade": a.prioridade,
            "status": a.status,
            "tempo_resolucao_min": _num(a.tempo_resolucao_min),
            "satisfacao": _num(a.satisfacao),
        }

    def existe(self, cid: str) -> bool:
        return cid in self.ds.clientes and cid in self.riscos

    def atendimentos_de(self, cid: str) -> list:
        return self._at_por_cliente.get(cid, [])

    def cliente_resumo(self, cid) -> dict:
        c = self.ds.clientes[cid]
        r = self.riscos[cid]
        return {
            "cliente_id": c.cliente_id,
            "nome": c.nome,
            "porte": c.porte,
            "setor": c.setor,
            "cidade": c.cidade,
            "score": r.score,
            "faixa": r.faixa,
            "perfil": r.perfil,
            "motivo_principal": r.motivo_principal,
            "uso_total": r.uso_total,
            "pendentes": r.pendentes,
            "satisfacao_media": r.satisfacao_media,
            "contatado_em": _iso(self.contatos.get(cid)),
        }

    def cliente_detalhe(self, cid) -> dict:
        c = self.ds.clientes[cid]
        r = self.riscos[cid]
        uso = sorted(
            (u for u in self.ds.uso if u.cliente_id == cid), key=lambda u: (u.mes, u.servico)
        )
        return {
            "cliente": {
                "cliente_id": c.cliente_id,
                "nome": c.nome,
                "porte": c.porte,
                "setor": c.setor,
                "cidade": c.cidade,
                "data_cadastro": c.data_cadastro.isoformat() if c.data_cadastro else None,
                "meses_de_casa": r.meses_de_casa,
            },
            "score": r.score,
            "faixa": r.faixa,
            "perfil": r.perfil,
            "facetas": _facetas_dict(r),
            "contexto": {"impacto": c.porte, "sinais": list(r.sinais or [])},
            "uso": [
                {"mes": u.mes, "servico": u.servico, "acessos": u.acessos, "operacoes": u.operacoes}
                for u in uso
            ],
            "atendimentos": [self.atendimento_dict(a) for a in self.atendimentos_de(cid)],
            "contatado_em": _iso(self.contatos.get(cid)),
        }

    # ---------- listagem ----------
    def _clientes_filtrados(self, busca=None, faixa=None, perfil=None, porte=None,
                            setor=None, cidade=None, servico=None):
        b = _norm(busca) if busca else None
        servicos_por_cliente = None
        if servico:
            servicos_por_cliente = {}
            for u in self.ds.uso:
                servicos_por_cliente.setdefault(u.cliente_id, set()).add(u.servico)
            for a in self.ds.atendimentos:
                servicos_por_cliente.setdefault(a.cliente_id, set()).add(a.servico)
        for cid, c in self.ds.clientes.items():
            r = self.riscos.get(cid)
            if r is None:
                continue
            if b and b not in _norm(c.nome) and b not in _norm(cid):
                continue
            if faixa and r.faixa != faixa:
                continue
            if perfil and r.perfil != perfil:
                continue
            if porte and _norm(c.porte) != _norm(porte):
                continue
            if setor and _norm(c.setor) != _norm(setor):
                continue
            if cidade and _norm(c.cidade) != _norm(cidade):
                continue
            if servico and servico not in servicos_por_cliente.get(cid, set()):
                continue
            yield c, r

    def listar(self, ordenar="prioridade", direcao="desc", **filtros) -> list[dict]:
        pares = list(self._clientes_filtrados(**filtros))
        if ordenar == "nome":
            pares.sort(key=lambda p: _norm(p[0].nome), reverse=(direcao == "desc"))
        elif ordenar == "score":
            pares.sort(key=lambda p: p[1].score, reverse=(direcao != "asc"))
        else:
            pares.sort(key=lambda p: scoring.prioridade_key(p[1], p[0]))
            if direcao == "asc":
                pares.reverse()
        return [self.cliente_resumo(c.cliente_id) for c, _ in pares]

    # ---------- painel ----------
    def painel(self) -> dict:
        riscos = self.riscos
        distrib = {"alto": 0, "atencao": 0, "saudavel": 0}
        perfis = {"silencioso": 0, "frustrado": 0, "travado": 0, "saudavel": 0}
        for r in riscos.values():
            distrib[r.faixa] = distrib.get(r.faixa, 0) + 1
            perfis[r.perfil] = perfis.get(r.perfil, 0) + 1
        ats = self.ds.atendimentos
        pend = [a for a in ats if a.status == "Pendente"]
        sats = [a.satisfacao for a in ats if a.satisfacao is not None]
        tempos = [a.tempo_resolucao_min for a in ats if a.tempo_resolucao_min is not None]
        servicos: dict[str, dict] = {}
        for a in ats:
            s = servicos.setdefault(a.servico, {"servico": a.servico, "total": 0, "pendentes": 0})
            s["total"] += 1
            if a.status == "Pendente":
                s["pendentes"] += 1
        # variação: clientes em alto risco cujo contato ainda não foi feito não altera; usa
        # comparação simples com clientes de atenção alta não é possível sem histórico -> 0
        variacao = self._variacao_alto_risco()
        top = self.listar()[:5]
        return {
            "kpis": {
                "clientes_alto_risco": distrib.get("alto", 0),
                "clientes_alto_risco_variacao": variacao,
                "atendimentos_pendentes": len(pend),
                "pendentes_prioridade_alta": sum(1 for a in pend if a.prioridade == "Alta"),
                "satisfacao_media": round(sum(sats) / len(sats), 1) if sats else None,
                "tempo_medio_resolucao_min": round(sum(tempos) / len(tempos)) if tempos else None,
            },
            "distribuicao": distrib,
            "perfis": perfis,
            "prioridade_hoje": top,
            "atendimentos_por_servico": sorted(servicos.values(), key=lambda s: s["servico"]),
        }

    def _variacao_alto_risco(self) -> int:
        """Aproximação: clientes em alto risco hoje menos os que já estavam em alto risco
        considerando só o uso até o penúltimo mês (sem histórico, retorna 0 em caso de erro)."""
        try:
            alto_hoje = sum(1 for r in self.riscos.values() if r.faixa == "alto")
            com_queda_recente = 0
            for r in self.riscos.values():
                if r.faixa != "alto" or len(r.uso_total) < 3:
                    continue
                a, b, c = (x["operacoes"] for x in r.uso_total[-3:])
                if a and b and (b / a) >= 0.8 and c < b * 0.8:
                    com_queda_recente += 1
            return min(com_queda_recente, alto_hoje)
        except Exception:
            return 0

    # ---------- fila ----------
    def fila(self, ordem="inteligente", servico=None, assunto=None, canal=None) -> list[dict]:
        itens = []
        for a in self.ds.atendimentos:
            if a.status != "Pendente":
                continue
            if servico and a.servico != servico:
                continue
            if assunto and _norm(a.assunto) != _norm(assunto):
                continue
            if canal and _norm(a.canal) != _norm(canal):
                continue
            r = self.riscos.get(a.cliente_id)
            c = self.ds.clientes.get(a.cliente_id)
            if r is None or c is None:
                continue
            prio, motivo = scoring.prioridade_sugerida(a, r, self.ref)
            dias = max(0, (self.ref - a.data_abertura).days) if a.data_abertura else 0
            itens.append(
                {
                    "atendimento": self.atendimento_dict(a),
                    "cliente": {
                        "cliente_id": c.cliente_id,
                        "nome": c.nome,
                        "score": r.score,
                        "faixa": r.faixa,
                    },
                    "prioridade_sugerida": prio,
                    "dias_aberto": dias,
                    "motivo": motivo,
                    "_k": (
                        {"Crítica": 0, "Alta": 1, "Normal": 2}.get(prio, 3),
                        -r.score,
                        -PORTE_ORDEM.get(c.porte, 0),
                        a.data_abertura or datetime.min,
                    ),
                }
            )
        if ordem == "chegada":
            itens.sort(key=lambda i: i["atendimento"]["data_abertura"] or "")
        else:
            itens.sort(key=lambda i: i["_k"])
        out = []
        for pos, i in enumerate(itens, 1):
            i.pop("_k", None)
            out.append({"posicao": pos, **i})
        return out

    # ---------- contato ----------
    def marcar_contato(self, cid, observacao=None) -> datetime:
        agora = datetime.now().replace(microsecond=0)
        self.contatos[cid] = agora
        if self.database_url:
            try:
                import psycopg

                with psycopg.connect(self.database_url, connect_timeout=3) as conn:
                    conn.execute(
                        "INSERT INTO contatos (cliente_id, contatado_em, observacao) VALUES (%s, %s, %s)",
                        (cid, agora, observacao),
                    )
            except Exception as e:  # nunca derruba a rota
                log.warning("falha ao gravar contato no banco: %s", e)
        return agora
