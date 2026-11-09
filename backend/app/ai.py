"""Camada de IA (DeepSeek via SDK openai) com fallback por regras. Nunca lança exceção para as rotas."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Iterator

log = logging.getLogger("radar.ai")

FORMATOS = {"ligacao": "ligação telefônica", "email": "e-mail", "whatsapp": "mensagem de WhatsApp"}

SYSTEM_BASE = (
    "Você é o assistente de Sucesso do Cliente de uma empresa de software B2B. Escreva em português do Brasil, "
    "de forma direta e profissional. Você NÃO calcula score nem prevê churn: apenas explica, escreve e organiza "
    "com base nos dados recebidos. Use somente fatos presentes nos dados. Não inclua ressalvas sobre possíveis erros. "
    "Responda em texto simples, sem markdown: sem tabelas, sem asteriscos, sem títulos com #; use listas com hífen. "
    "Refira-se aos clientes pelo código (ex.: C022)."
)


def _model() -> str:
    return os.getenv("DEEPSEEK_MODEL") or "deepseek-flash"


def _client():
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        return None
    try:
        from openai import OpenAI

        return OpenAI(base_url=os.getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com", api_key=key, timeout=5, max_retries=0)
    except Exception as e:  # noqa: BLE001
        log.warning("cliente IA indisponível: %s", type(e).__name__)
        return None


def _sse(evento: str, dados: dict) -> str:
    return f"event: {evento}\ndata: {json.dumps(dados, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------- ação sugerida

def _contexto_cliente(d: dict) -> dict:
    cli = d.get("cliente", {})
    return {
        "cliente": {k: cli.get(k) for k in ("cliente_id", "porte", "setor", "cidade", "meses_de_casa")},
        "score": d.get("score"),
        "faixa": d.get("faixa"),
        "perfil": d.get("perfil"),
        "facetas": {k: v.get("descricao") for k, v in (d.get("facetas") or {}).items()},
        "sinais": (d.get("contexto") or {}).get("sinais", []),
        "uso": d.get("uso", [])[-12:],
        "atendimentos": [
            {k: a.get(k) for k in ("data_abertura", "servico", "assunto", "canal", "prioridade", "status", "satisfacao")}
            for a in (d.get("atendimentos") or [])[:8]
        ],
    }


def _baseado_em(d: dict) -> dict:
    meses = {u.get("mes") for u in d.get("uso", []) if u.get("mes")}
    return {"atendimentos": len(d.get("atendimentos") or []), "meses_de_uso": len(meses)}


def _acao_regras(d: dict, formato: str) -> dict:
    cli = d.get("cliente", {})
    nome = cli.get("nome", "o cliente")
    perfil = d.get("perfil") or "saudavel"
    sinais = (d.get("contexto") or {}).get("sinais", [])
    ats = d.get("atendimentos") or []
    pend = [a for a in ats if a.get("status") == "Pendente"]
    assunto = (pend or ats or [{}])[0].get("assunto") or "o uso do sistema"
    servico = (pend or ats or [{}])[0].get("servico") or "nossos serviços"
    motivo = ""
    fac = d.get("facetas") or {}
    if fac:
        maior = max(fac.values(), key=lambda f: f.get("contribuicao", 0))
        motivo = maior.get("descricao", "")
    resumo = (
        f"{nome}, porte {cli.get('porte', '—')} do setor {cli.get('setor', '—')} em {cli.get('cidade', '—')}, "
        f"está com score {d.get('score', '—')} ({d.get('faixa', '—')}) e perfil {perfil}."
        + (f" Principal sinal: {motivo}." if motivo else "")
    )
    if perfil == "silencioso":
        passo = "Reengajar o cliente: entrar em contato para entender a queda de uso e retomar a rotina."
        roteiro = [
            f"Cumprimentar e dizer que notamos menos movimento no {servico} nos últimos meses.",
            "Perguntar se algo mudou na operação ou se há dificuldade que não chegou ao suporte.",
            "Oferecer uma sessão curta de acompanhamento para retomar o uso.",
        ]
    elif perfil == "frustrado":
        passo = "Escalar ao suporte e dar retorno rápido sobre os atendimentos em aberto."
        roteiro = [
            f"Reconhecer o transtorno com {assunto} e pedir desculpas pela demora.",
            "Informar que o caso foi escalado ao suporte e combinar um prazo de retorno.",
            "Confirmar a melhor forma de manter o cliente atualizado.",
        ]
    elif perfil == "travado":
        passo = "Destravar os atendimentos pendentes junto ao suporte antes de qualquer oferta."
        roteiro = [
            f"Informar que estamos acompanhando os {len(pend)} atendimento(s) pendente(s).",
            f"Alinhar o que falta para resolver {assunto} e quem responde por cada item.",
            "Combinar data para a próxima atualização.",
        ]
    else:
        passo = "Manter o relacionamento com um contato de acompanhamento."
        roteiro = [
            "Agradecer a parceria e perguntar como está a experiência.",
            "Verificar se há necessidades novas.",
            "Registrar o contato.",
        ]
    if any(str(s).startswith("cliente_recente") for s in sinais):
        roteiro.append("Cliente recente: avaliar oferecer um treinamento, se fizer sentido com o contexto acima.")
    if formato == "email":
        roteiro.insert(0, f"Assunto sugerido: Acompanhamento da sua conta, {nome}")
    elif formato == "whatsapp":
        roteiro = [r for r in roteiro][:3]
        passo += " Mensagem curta e objetiva."
    else:
        passo += " Ligar hoje."
    return {"fonte": "regras", "resumo": resumo, "proximo_passo": passo, "roteiro": roteiro, "baseado_em": _baseado_em(d)}


def _prompt_acao(d: dict, formato: str, texto: bool) -> str:
    base = (
        f"Formato de contato: {FORMATOS.get(formato, formato)}.\n"
        "Regras: perfil silencioso -> reengajar; frustrado -> escalar ao suporte; travado -> destravar os atendimentos pendentes; "
        "se houver o sinal cliente_recente, considere treinamento junto com os demais sinais, sem torná-lo automático. "
        f"Dados do cliente (JSON):\n{json.dumps(_contexto_cliente(d), ensure_ascii=False, default=str)}\n\n"
    )
    if texto:
        return base + (
            "Responda exatamente neste formato de texto:\nRESUMO: <2 frases>\nPROXIMO PASSO: <1 frase>\nROTEIRO:\n- <passo 1>\n- <passo 2>\n- <passo 3>"
        )
    return base + 'Responda SOMENTE com JSON: {"resumo": str, "proximo_passo": str, "roteiro": [str, str, str]}'


def _valida(obj, d: dict) -> dict | None:
    try:
        if not isinstance(obj, dict):
            return None
        resumo, passo, roteiro = obj.get("resumo"), obj.get("proximo_passo"), obj.get("roteiro")
        if not (isinstance(resumo, str) and resumo.strip() and isinstance(passo, str) and passo.strip()):
            return None
        if not isinstance(roteiro, list) or not roteiro:
            return None
        return {
            "fonte": "ia", "resumo": resumo.strip(), "proximo_passo": passo.strip(),
            "roteiro": [str(r).strip() for r in roteiro if str(r).strip()], "baseado_em": _baseado_em(d),
        }
    except Exception:  # noqa: BLE001
        return None


def _parse_texto(txt: str, d: dict) -> dict | None:
    m = re.search(r"RESUMO:\s*(.*?)\s*PR[OÓ]XIMO PASSO:\s*(.*?)\s*ROTEIRO:\s*(.*)", txt, re.S | re.I)
    if not m:
        return None
    roteiro = [re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", l).strip() for l in m.group(3).splitlines()]
    return _valida({"resumo": m.group(1), "proximo_passo": m.group(2), "roteiro": [r for r in roteiro if r]}, d)


def _detalhe(store, cid: str) -> dict | None:
    try:
        return store.cliente_detalhe(cid)
    except Exception as e:  # noqa: BLE001
        log.warning("detalhe indisponível: %s", type(e).__name__)
        return None


_VAZIO = {"cliente": {}, "facetas": {}, "contexto": {}, "uso": [], "atendimentos": []}


def sugerir_acao(store, cliente_id: str, formato: str) -> dict:
    d = _detalhe(store, cliente_id) or _VAZIO
    try:
        cli = _client()
        if cli is not None and d is not _VAZIO:
            r = cli.chat.completions.create(
                model=_model(),
                messages=[{"role": "system", "content": SYSTEM_BASE}, {"role": "user", "content": _prompt_acao(d, formato, False)}],
                response_format={"type": "json_object"},
                temperature=0.4,
            )
            txt = r.choices[0].message.content or ""
            m = re.search(r"\{.*\}", txt, re.S)
            ok = _valida(json.loads(m.group(0)), d) if m else None
            if ok:
                return ok
    except Exception as e:  # noqa: BLE001
        log.warning("IA falhou em sugerir_acao: %s", type(e).__name__)
    try:
        return _acao_regras(d, formato)
    except Exception:  # noqa: BLE001
        return {"fonte": "regras", "resumo": "Cliente em acompanhamento.", "proximo_passo": "Entrar em contato.",
                "roteiro": ["Entrar em contato com o cliente."], "baseado_em": {"atendimentos": 0, "meses_de_uso": 0}}


def sugerir_acao_stream(store, cliente_id: str, formato: str) -> Iterator[str]:
    d = _detalhe(store, cliente_id) or _VAZIO
    meta_enviado = False
    try:
        cli = _client()
        if cli is not None and d is not _VAZIO:
            stream = cli.chat.completions.create(
                model=_model(),
                messages=[{"role": "system", "content": SYSTEM_BASE}, {"role": "user", "content": _prompt_acao(d, formato, True)}],
                stream=True, temperature=0.4,
            )
            yield _sse("meta", {"fonte": "ia"})
            meta_enviado = True
            acum = ""
            for ch in stream:
                if not ch.choices:
                    continue
                t = getattr(ch.choices[0].delta, "content", None)
                if t:
                    acum += t
                    yield _sse("delta", {"texto": t})
            final = _parse_texto(acum, d)
            if final:
                yield _sse("fim", final)
                return
            yield _sse("fim", _acao_regras(d, formato))
            return
    except Exception as e:  # noqa: BLE001
        log.warning("IA falhou em stream de ação: %s", type(e).__name__)
        yield from _fim_regras_acao(d, formato, meta=not meta_enviado)
        return
    yield from _fim_regras_acao(d, formato, meta=True)


def _fim_regras_acao(d: dict, formato: str, meta: bool) -> Iterator[str]:
    r = _acao_regras(d, formato)
    if meta:
        yield _sse("meta", {"fonte": "regras"})
        yield _sse("delta", {"texto": r["resumo"] + "\n" + r["proximo_passo"]})
    yield _sse("fim", r)


# ---------------------------------------------------------------- agente

TOOLS_BASE = [
    {"type": "function", "function": {
        "name": "listar_clientes", "description": "Lista clientes da carteira com filtros opcionais, ordenados por prioridade.",
        "parameters": {"type": "object", "properties": {
            "faixa": {"type": "string", "enum": ["alto", "atencao", "saudavel"]},
            "perfil": {"type": "string", "enum": ["silencioso", "frustrado", "travado", "saudavel"]},
            "porte": {"type": "string", "enum": ["Micro", "Pequena", "Média"]},
            "setor": {"type": "string"}, "cidade": {"type": "string"},
            "servico": {"type": "string", "enum": ["Sistema Alfa", "Sistema Beta", "Portal Web", "Aplicativo Mobile"]},
            "limite": {"type": "integer"}}}}},
    {"type": "function", "function": {
        "name": "detalhe_cliente", "description": "Detalhe completo de um cliente (score, facetas, uso, atendimentos).",
        "parameters": {"type": "object", "properties": {"cliente_id": {"type": "string"}}, "required": ["cliente_id"]}}},
    {"type": "function", "function": {
        "name": "resumo_carteira", "description": "KPIs e distribuição da carteira inteira.",
        "parameters": {"type": "object", "properties": {}}}},
]
TOOL_INSIGHTS = {"type": "function", "function": {
    "name": "insights_produto", "description": "Concentração de problemas por serviço na carteira inteira.",
    "parameters": {"type": "object", "properties": {}}}}

_FILTROS = ("faixa", "perfil", "porte", "setor", "cidade", "servico")


def _insights(store) -> list:
    try:
        from app import scoring

        return scoring.insights_produto(store.ds)
    except Exception:  # noqa: BLE001
        f = getattr(store, "insights_produto", None)
        return f() if callable(f) else []


def _executar_tool(store, nome: str, args: dict, papel: str, coletados: list):
    if nome == "listar_clientes":
        filtros = {k: args[k] for k in _FILTROS if args.get(k)}
        itens = store.listar(**filtros)
        lim = args.get("limite")
        lim = lim if isinstance(lim, int) and 0 < lim <= 50 else 15
        itens = itens[:lim]
        coletados.extend(itens)
        return {"total": len(itens), "itens": [
            {k: i.get(k) for k in ("cliente_id", "porte", "setor", "cidade", "score", "faixa", "perfil", "motivo_principal", "pendentes")}
            for i in itens]}
    if nome == "detalhe_cliente":
        return _contexto_cliente(store.cliente_detalhe(str(args.get("cliente_id", ""))))
    if nome == "resumo_carteira":
        p = store.painel()
        return {k: p.get(k) for k in ("kpis", "distribuicao", "perfis", "atendimentos_por_servico")}
    if nome == "insights_produto":
        if papel != "gestor":
            return {"erro": "ferramenta disponível apenas para o gestor"}
        return {"itens": _insights(store)}
    return {"erro": "ferramenta desconhecida"}


def _dedup(itens: list) -> list:
    vistos, out = set(), []
    for i in itens:
        if i.get("cliente_id") not in vistos:
            vistos.add(i.get("cliente_id"))
            out.append(i)
    return out[:15]


def _agente_regras(store, pergunta: str, papel: str) -> dict:
    p = pergunta.lower()
    filtros: dict = {}
    if re.search(r"alto risco|cr[ií]tic|maior risco|em risco|risco alto", p):
        filtros["faixa"] = "alto"
    elif "aten" in p:
        filtros["faixa"] = "atencao"
    for perfil in ("silencios", "frustrad", "travad"):
        if perfil in p:
            filtros["perfil"] = {"silencios": "silencioso", "frustrad": "frustrado", "travad": "travado"}[perfil]
    for porte in ("micro", "pequena", "média", "media"):
        if re.search(rf"\b{porte}\b", p):
            filtros["porte"] = "Média" if porte.startswith("m") and porte != "micro" else porte.capitalize()
    for s in ("Sistema Alfa", "Sistema Beta", "Portal Web", "Aplicativo Mobile"):
        if s.lower() in p:
            filtros["servico"] = s
    try:
        todos = store.listar()
        for campo in ("setor", "cidade"):
            for v in {t.get(campo) for t in todos if t.get(campo)}:
                if str(v).lower() in p:
                    filtros[campo] = v
    except Exception:  # noqa: BLE001
        pass
    usadas = ["listar_clientes"]
    if re.search(r"resumo|panorama|carteira|kpi|vis[aã]o geral", p) and not filtros:
        pn = store.painel()
        k, dist = pn.get("kpis", {}), pn.get("distribuicao", {})
        return {"fonte": "regras", "ferramentas_usadas": ["resumo_carteira"], "clientes": [],
                "resposta": f"A carteira tem {dist.get('alto', 0)} clientes em alto risco, {dist.get('atencao', 0)} em atenção e "
                            f"{dist.get('saudavel', 0)} saudáveis, com {k.get('atendimentos_pendentes', 0)} atendimentos pendentes."}
    if papel == "gestor" and re.search(r"produto|insight|servi[cç]o", p) and not filtros:
        its = _insights(store)[:3]
        txt = "; ".join(i.get("descricao", "") for i in its) or "Sem concentração relevante de problemas por serviço."
        return {"fonte": "regras", "ferramentas_usadas": ["insights_produto"], "clientes": [], "resposta": txt}
    itens = store.listar(**filtros)
    top = itens[:10]
    if not itens:
        resp = "Não encontrei clientes com esses critérios."
    else:
        resp = f"Encontrei {len(itens)} cliente(s)" + (f" com {', '.join(f'{k} {v}' for k, v in filtros.items())}" if filtros else "") + ". Prioridade: " + \
               "; ".join(f"{i.get('nome')} (score {i.get('score')})" for i in top[:5]) + "."
    return {"fonte": "regras", "resposta": resp, "ferramentas_usadas": usadas, "clientes": top}


def perguntar(store, pergunta: str, papel: str) -> dict:
    try:
        cli = _client()
        if cli is not None:
            tools = TOOLS_BASE + ([TOOL_INSIGHTS] if papel == "gestor" else [])
            msgs = [
                {"role": "system", "content": SYSTEM_BASE + " Use as ferramentas para consultar a carteira antes de responder; "
                 "nunca invente clientes ou números. Seja conciso."},
                {"role": "user", "content": pergunta},
            ]
            usadas: list[str] = []
            coletados: list = []
            for _ in range(2):
                r = cli.chat.completions.create(model=_model(), messages=msgs, tools=tools, temperature=0.2)
                msg = r.choices[0].message
                if not msg.tool_calls:
                    if msg.content and msg.content.strip():
                        return {"fonte": "ia", "resposta": msg.content.strip(), "ferramentas_usadas": usadas,
                                "clientes": _dedup(coletados)}
                    break
                msgs.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
                    {"id": t.id, "type": "function", "function": {"name": t.function.name, "arguments": t.function.arguments}}
                    for t in msg.tool_calls]})
                for t in msg.tool_calls:
                    try:
                        args = json.loads(t.function.arguments or "{}")
                        res = _executar_tool(store, t.function.name, args if isinstance(args, dict) else {}, papel, coletados)
                    except Exception as e:  # noqa: BLE001
                        res = {"erro": type(e).__name__}
                    if t.function.name not in usadas:
                        usadas.append(t.function.name)
                    msgs.append({"role": "tool", "tool_call_id": t.id, "content": json.dumps(res, ensure_ascii=False, default=str)[:12000]})
            # iterações esgotadas: pede resposta final sem tools
            r = cli.chat.completions.create(model=_model(), messages=msgs, temperature=0.2)
            txt = (r.choices[0].message.content or "").strip()
            if txt:
                return {"fonte": "ia", "resposta": txt, "ferramentas_usadas": usadas, "clientes": _dedup(coletados)}
    except Exception as e:  # noqa: BLE001
        log.warning("IA falhou em perguntar: %s", type(e).__name__)
    try:
        return _agente_regras(store, pergunta, papel)
    except Exception as e:  # noqa: BLE001
        log.warning("regras do agente falharam: %s", type(e).__name__)
        return {"fonte": "regras", "resposta": "Não consegui consultar a carteira agora. Tente novamente.", "ferramentas_usadas": [], "clientes": []}


def perguntar_stream(store, pergunta: str, papel: str) -> Iterator[str]:
    r = perguntar(store, pergunta, papel)
    yield _sse("meta", {"fonte": r.get("fonte", "regras")})
    texto = r.get("resposta", "")
    for i in range(0, len(texto), 60):
        yield _sse("delta", {"texto": texto[i:i + 60]})
    yield _sse("fim", r)


# ---------------------------------------------------------------- resumo executivo

def _resumo_regras(store) -> str:
    p = store.painel()
    k, d, pf = p.get("kpis", {}), p.get("distribuicao", {}), p.get("perfis", {})
    sat = k.get("satisfacao_media")
    txt = (f"A carteira soma {sum(d.values())} clientes: {d.get('alto', 0)} em alto risco, {d.get('atencao', 0)} em atenção e "
           f"{d.get('saudavel', 0)} saudáveis. Há {k.get('atendimentos_pendentes', 0)} atendimentos pendentes, "
           f"{k.get('pendentes_prioridade_alta', 0)} de prioridade alta")
    txt += f", e a satisfação média é {str(sat).replace('.', ',')}." if sat is not None else "."
    if pf:
        pri = max((x for x in pf.items() if x[0] != "saudavel"), key=lambda x: x[1], default=None)
        if pri:
            txt += f" O perfil de risco mais frequente é o {pri[0]} ({pri[1]} clientes)."
    its = _insights(store)[:1]
    if its and its[0].get("descricao"):
        txt += " Destaque de produto: " + its[0]["descricao"] + "."
    return txt


def resumo_executivo(store) -> str:
    try:
        cli = _client()
        if cli is not None:
            p = store.painel()
            dados = {"kpis": p.get("kpis"), "distribuicao": p.get("distribuicao"), "perfis": p.get("perfis"),
                     "top_risco": [{k: i.get(k) for k in ("cliente_id", "score", "perfil", "motivo_principal")} for i in store.listar(faixa="alto")[:5]],
                     "insights_produto": _insights(store)[:3]}
            r = cli.chat.completions.create(model=_model(), temperature=0.3, messages=[
                {"role": "system", "content": SYSTEM_BASE},
                {"role": "user", "content": "Escreva um parágrafo executivo curto (até 90 palavras) para a diretoria com base nestes dados:\n"
                 + json.dumps(dados, ensure_ascii=False, default=str)}])
            txt = (r.choices[0].message.content or "").strip()
            if txt:
                return txt
    except Exception as e:  # noqa: BLE001
        log.warning("IA falhou em resumo_executivo: %s", type(e).__name__)
    try:
        return _resumo_regras(store)
    except Exception:  # noqa: BLE001
        return "Resumo indisponível no momento."
