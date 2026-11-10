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
        self.contatos_por: dict[str, str] = {}
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
            "contatado_por": self.contatos_por.get(cid),
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
            "contatado_por": self.contatos_por.get(cid),
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
    def marcar_contato(self, cid, observacao=None, usuario=None) -> datetime:
        agora = datetime.now().replace(microsecond=0)
        self.contatos[cid] = agora
        if usuario:
            self.contatos_por[cid] = usuario.get("nome")
        if self.database_url:
            try:
                import psycopg

                with psycopg.connect(self.database_url, connect_timeout=3) as conn:
                    conn.execute(
                        "INSERT INTO contatos (cliente_id, contatado_em, observacao, usuario_id) VALUES (%s, %s, %s, %s)",
                        (cid, agora, observacao, (usuario or {}).get("id")),
                    )
            except Exception as e:  # nunca derruba a rota
                log.warning("falha ao gravar contato no banco: %s", e)
        return agora

    # ---------- visão do gestor ----------
    def visao_gestor(self) -> dict:
        """Carteira consolidada: tendência, concentração de risco, execução do time e produto."""
        riscos, clientes = self.riscos, self.ds.clientes
        pares = [(clientes[cid], r) for cid, r in riscos.items() if cid in clientes]
        total = len(pares)
        alto = [(c, r) for c, r in pares if r.faixa == "alto"]
        em_risco = [(c, r) for c, r in pares if r.faixa in ("alto", "atencao")]

        # evolução mensal da carteira (uso total + atendimentos abertos no mês)
        meses: dict[str, dict] = {}

        def _mes(mes):
            return meses.setdefault(mes, {"mes": mes, "operacoes": 0, "acessos": 0, "operacoes_em_risco": 0,
                                          "operacoes_saudaveis": 0, "atendimentos": 0, "_notas": []})

        for u in self.ds.uso:
            m = _mes(u.mes)
            m["operacoes"] += u.operacoes or 0
            m["acessos"] += u.acessos or 0
            r = riscos.get(u.cliente_id)
            if r is not None:
                m["operacoes_em_risco" if r.faixa in ("alto", "atencao") else "operacoes_saudaveis"] += u.operacoes or 0
        for a in self.ds.atendimentos:
            if not a.data_abertura:
                continue
            m = _mes(a.data_abertura.strftime("%Y-%m"))
            m["atendimentos"] += 1
            if a.satisfacao is not None:
                m["_notas"].append(a.satisfacao)
        evolucao = []
        for mes in sorted(meses):
            m = meses[mes]
            notas = m.pop("_notas")
            m["satisfacao_media"] = round(sum(notas) / len(notas), 1) if notas else None
            evolucao.append(m)

        def variacao(campo):
            vals = [m[campo] for m in evolucao if m.get(campo) is not None]
            if len(vals) < 2 or not vals[0]:
                return None
            return round((vals[-1] - vals[0]) / vals[0] * 100)

        # concentração de risco por segmento
        def por(attr):
            grupos: dict[str, dict] = {}
            for c, r in pares:
                v = getattr(c, attr) or "—"
                g = grupos.setdefault(v, {"valor": v, "total": 0, "alto": 0, "atencao": 0, "saudavel": 0})
                g["total"] += 1
                g[r.faixa] = g.get(r.faixa, 0) + 1
            out = list(grupos.values())
            for g in out:
                g["em_risco_pct"] = round((g["alto"] + g["atencao"]) / g["total"] * 100) if g["total"] else 0
            out.sort(key=lambda g: (-g["em_risco_pct"], -g["alto"], g["valor"]))
            return out

        # perfis de risco
        perfis: dict[str, dict] = {}
        for c, r in pares:
            p = perfis.setdefault(r.perfil, {"perfil": r.perfil, "clientes": 0, "alto": 0, "_scores": []})
            p["clientes"] += 1
            p["alto"] += 1 if r.faixa == "alto" else 0
            p["_scores"].append(r.score)
        lista_perfis = []
        for p in perfis.values():
            s = p.pop("_scores")
            p["score_medio"] = round(sum(s) / len(s)) if s else None
            lista_perfis.append(p)
        lista_perfis.sort(key=lambda p: -(p["score_medio"] or 0))

        # execução do time: cobertura do alto risco e contatos por pessoa
        contatados_alto = sum(1 for c, _ in alto if c.cliente_id in self.contatos)
        por_pessoa: dict[str, int] = {}
        for cid in self.contatos:
            nome = self.contatos_por.get(cid) or "Sem identificação"
            por_pessoa[nome] = por_pessoa.get(nome, 0) + 1
        sem_contato = sorted(
            ((c, r) for c, r in alto if c.cliente_id not in self.contatos),
            key=lambda p: scoring.prioridade_key(p[1], p[0]),
        )

        # backlog de chamados pendentes por idade
        faixas_idade = [("0–7 dias", 0, 7), ("8–14 dias", 8, 14), ("15–30 dias", 15, 30), ("Mais de 30 dias", 31, 10**6)]
        backlog = [{"faixa": f, "total": 0, "criticos": 0} for f, _, _ in faixas_idade]
        mais_antigo = 0
        pendentes = [a for a in self.ds.atendimentos if a.status == "Pendente"]
        for a in pendentes:
            dias = max(0, (self.ref - a.data_abertura).days) if a.data_abertura else 0
            mais_antigo = max(mais_antigo, dias)
            r = riscos.get(a.cliente_id)
            critico = r is not None and scoring.prioridade_sugerida(a, r, self.ref)[0] == "Crítica"
            for b, (_, lo, hi) in zip(backlog, faixas_idade):
                if lo <= dias <= hi:
                    b["total"] += 1
                    b["criticos"] += 1 if critico else 0
                    break

        # produto: matriz serviço × assunto (só gestor; não entra no score)
        celulas: dict[tuple[str, str], list] = {}
        for a in self.ds.atendimentos:
            celulas.setdefault((a.servico or "—", a.assunto or "—"), []).append(a)
        servicos = sorted({k[0] for k in celulas})
        assuntos = sorted({k[1] for k in celulas})
        matriz = []
        for (s, ass), ats in sorted(celulas.items()):
            notas = [a.satisfacao for a in ats if a.satisfacao is not None]
            matriz.append({
                "servico": s, "assunto": ass, "atendimentos": len(ats),
                "pendentes": sum(1 for a in ats if a.status == "Pendente"),
                "satisfacao_media": round(sum(notas) / len(notas), 1) if notas else None,
            })

        sats = [a.satisfacao for a in self.ds.atendimentos if a.satisfacao is not None]
        return {
            "kpis": {
                "total_clientes": total,
                "clientes_em_risco": len(em_risco),
                "clientes_alto_risco": len(alto),
                "uso_variacao_pct": variacao("operacoes"),
                "uso_em_risco_variacao_pct": variacao("operacoes_em_risco"),
                "clientes_uso_em_queda": sum(
                    1 for _, r in pares
                    if len(r.uso_total) >= 2 and r.uso_total[0]["operacoes"]
                    and (r.uso_total[0]["operacoes"] - r.uso_total[-1]["operacoes"]) / r.uso_total[0]["operacoes"] >= 0.2
                ),
                "satisfacao_media": round(sum(sats) / len(sats), 1) if sats else None,
                "satisfacao_variacao": (
                    round(evolucao[-1]["satisfacao_media"] - evolucao[0]["satisfacao_media"], 1)
                    if len(evolucao) >= 2 and evolucao[0]["satisfacao_media"] is not None
                    and evolucao[-1]["satisfacao_media"] is not None else None
                ),
                "alto_risco_contatados": contatados_alto,
            },
            "evolucao": evolucao,
            "segmentos": {"porte": por("porte"), "setor": por("setor"), "cidade": por("cidade")},
            "perfis": lista_perfis,
            "cobertura": {
                "alto_risco": len(alto),
                "contatados": contatados_alto,
                "por_pessoa": sorted(({"nome": n, "contatos": k} for n, k in por_pessoa.items()), key=lambda x: -x["contatos"]),
                "sem_contato": [
                    {"cliente_id": c.cliente_id, "nome": c.nome, "porte": c.porte, "score": r.score,
                     "motivo_principal": r.motivo_principal}
                    for c, r in sem_contato[:5]
                ],
            },
            "backlog": {"pendentes": len(pendentes), "mais_antigo_dias": mais_antigo, "faixas": backlog},
            "produto": {"servicos": servicos, "assuntos": assuntos, "celulas": matriz,
                        "destaques": scoring.insights_produto(self.ds)[:3]},
        }
