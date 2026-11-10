"""Testes da frente 2 (auth, rotas, store) com stubs das frentes 1 e 3."""
import sys
import types
from datetime import date, datetime
from types import SimpleNamespace as NS

import pytest

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))


def _instalar_stubs():
    mods = {}

    data = types.ModuleType("app.data")
    clientes = {
        "C001": NS(cliente_id="C001", nome="Alfa Ltda", porte="Média", setor="Comércio", cidade="Canoas", data_cadastro=date(2023, 3, 14)),
        "C002": NS(cliente_id="C002", nome="Beta SA", porte="Micro", setor="Indústria", cidade="Porto Alegre", data_cadastro=date(2020, 1, 2)),
    }
    ats = [
        NS(atendimento_id="A1", cliente_id="C001", data_abertura=datetime(2026, 9, 14, 10, 22), servico="Sistema Alfa", assunto="Lentidão", canal="WhatsApp", prioridade="Alta", status="Pendente", tempo_resolucao_min=None, satisfacao=None),
        NS(atendimento_id="A2", cliente_id="C002", data_abertura=datetime(2026, 9, 1, 9, 0), servico="Portal Web", assunto="Erro", canal="Email", prioridade="Baixa", status="Resolvido", tempo_resolucao_min=120.0, satisfacao=4.0),
    ]
    uso = [NS(cliente_id="C001", mes="2026-09", servico="Sistema Alfa", acessos=10, operacoes=20)]
    data.load_all = lambda d, u: NS(clientes=clientes, atendimentos=ats, uso=uso)
    mods["app.data"] = data

    scoring = types.ModuleType("app.scoring")
    def faceta(n, p, c, d): return NS(nota=n, peso=p, contribuicao=c, descricao=d)
    def compute_all(ds):
        return {
            "C001": NS(cliente_id="C001", score=88, faixa="alto", perfil="frustrado", motivo_principal="Queda", uso_total=[{"mes": "2026-09", "acessos": 10, "operacoes": 20}],
                       facetas={"engajamento": faceta(90, 0.4, 36, "x"), "atrito": faceta(80, 0.35, 28, "y"), "satisfacao": faceta(96, 0.25, 24, "z")},
                       pendentes=1, pendentes_alta=1, satisfacao_media=None, sinais=["cliente_recente"], meses_de_casa=31),
            "C002": NS(cliente_id="C002", score=20, faixa="saudavel", perfil="saudavel", motivo_principal="Estável", uso_total=[],
                       facetas={}, pendentes=0, pendentes_alta=0, satisfacao_media=4.0, sinais=[], meses_de_casa=70),
        }
    scoring.compute_all = compute_all
    scoring.prioridade_key = lambda r, c: (-r.score, -{"Micro": 1, "Pequena": 2, "Média": 3}[c.porte])
    scoring.insights_produto = lambda ds: [{"servico": "Sistema Alfa", "assunto": "Lentidão", "atendimentos": 1, "satisfacao_media": None, "clientes_afetados": 1, "descricao": "d"}]
    scoring.prioridade_sugerida = lambda at, r, ref: ("Crítica", "Cliente em alto risco")
    mods["app.scoring"] = scoring

    ml = types.ModuleType("app.ml")
    ml.assign_profiles = lambda r: None
    ml.train_churn_sim = lambda seed=42: object()
    ml.churn_sim_info = lambda: {"amostras": 2000, "acuracia": 0.81, "coeficientes": {"engajamento": 1.9}}
    mods["app.ml"] = ml

    ai = types.ModuleType("app.ai")
    ai.sugerir_acao = lambda store, cid, f: {"fonte": "regras", "resumo": "r", "proximo_passo": "p", "roteiro": [], "baseado_em": {"atendimentos": 1, "meses_de_uso": 1}}
    ai.sugerir_acao_stream = lambda store, cid, f: iter(['event: meta\ndata: {"fonte": "regras"}\n\n', 'event: fim\ndata: {}\n\n'])
    ai.perguntar = lambda store, q, papel: {"fonte": "regras", "resposta": q, "ferramentas_usadas": [], "clientes": []}
    ai.perguntar_stream = lambda store, q, papel: iter(['event: fim\ndata: {}\n\n'])
    mods["app.ai"] = ai

    reports = types.ModuleType("app.reports")
    reports.relatorio_analista_xlsx = lambda s, f: b"xlsx"
    reports.relatorio_analista_pdf = lambda s, f: b"%PDF"
    reports.relatorio_gestor_xlsx = lambda s: b"xlsx"
    reports.relatorio_gestor_pdf = lambda s: b"%PDF"
    mods["app.reports"] = reports
    return mods


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    import os
    os.environ.setdefault("DATA_DIR", "/nonexistent")
    os.environ["DATABASE_URL"] = "postgresql://x:x@127.0.0.1:1/x"  # inalcançável: força fallback
    os.environ.setdefault("CORS_ORIGIN", "http://localhost:5173")
    os.environ["JWT_SECRET"] = "teste"
    stubs = _instalar_stubs()
    salvos = {k: sys.modules.get(k) for k in list(stubs) + ["app.main", "app.routes"]}
    for k in list(sys.modules):
        if k.startswith("app.routes") or k in ("app.main", "app.store", "app.auth"):
            sys.modules.pop(k)
    sys.modules.update(stubs)
    import app as _pkg  # `from app import x` lê o atributo do pacote, não só sys.modules
    salvos_attr = {k.split(".")[1]: getattr(_pkg, k.split(".")[1], None) for k in stubs}
    for k, m in stubs.items():
        setattr(_pkg, k.split(".")[1], m)
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c
    for k, v in salvos.items():
        if v is None:
            sys.modules.pop(k, None)
        else:
            sys.modules[k] = v
    for nome, m in salvos_attr.items():
        if m is not None:
            setattr(_pkg, nome, m)


def _login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "senha": "radar123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_login_ok_e_me(client):
    r = client.post("/api/auth/login", json={"email": "analista@radar.local", "senha": "radar123"})
    assert r.status_code == 200
    assert r.json()["usuario"] == {"id": 1, "nome": "Ana Analista", "papel": "analista"}
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/me", headers=h).json()["papel"] == "analista"


def test_login_401(client):
    r = client.post("/api/auth/login", json={"email": "analista@radar.local", "senha": "errada"})
    assert r.status_code == 401
    assert r.json()["erro"]["codigo"] == "nao_autenticado"


def test_sem_token_401(client):
    r = client.get("/api/painel")
    assert r.status_code == 401
    assert set(r.json()["erro"]) == {"codigo", "mensagem"}


def test_painel(client):
    h = _login(client, "analista@radar.local")
    j = client.get("/api/painel", headers=h).json()
    assert j["kpis"]["clientes_alto_risco"] == 1
    assert j["kpis"]["atendimentos_pendentes"] == 1
    assert j["kpis"]["satisfacao_media"] == 4.0
    assert j["distribuicao"] == {"alto": 1, "atencao": 0, "saudavel": 1}
    assert j["prioridade_hoje"][0]["cliente_id"] == "C001"


def test_clientes_filtro(client):
    h = _login(client, "analista@radar.local")
    j = client.get("/api/clientes", params={"faixa": "alto"}, headers=h).json()
    assert j["total"] == 1 and j["itens"][0]["cliente_id"] == "C001"
    assert client.get("/api/clientes", params={"busca": "beta"}, headers=h).json()["total"] == 1
    assert client.get("/api/clientes", params={"faixa": "xyz"}, headers=h).status_code == 422
    j = client.get("/api/clientes", params={"ordenar": "nome", "direcao": "asc"}, headers=h).json()
    assert [i["cliente_id"] for i in j["itens"]] == ["C001", "C002"]


def test_cliente_detalhe_e_404(client):
    h = _login(client, "analista@radar.local")
    d = client.get("/api/clientes/C001", headers=h).json()
    assert d["atendimentos"][0]["tempo_resolucao_min"] is None
    assert d["cliente"]["data_cadastro"] == "2023-03-14"
    r = client.get("/api/clientes/C999", headers=h)
    assert r.status_code == 404
    assert r.json()["erro"]["codigo"] == "nao_encontrado"


def test_contato_e_fila(client):
    h = _login(client, "analista@radar.local")
    r = client.post("/api/clientes/C001/contato", json={"observacao": "ok"}, headers=h)
    assert r.status_code == 200 and r.json()["cliente_id"] == "C001"
    assert client.get("/api/clientes/C001", headers=h).json()["contatado_em"] is not None
    f = client.get("/api/atendimentos/fila", headers=h).json()
    assert f["total"] == 1 and f["itens"][0]["posicao"] == 1
    assert f["itens"][0]["prioridade_sugerida"] == "Crítica"


def test_acao_e_stream(client):
    h = _login(client, "analista@radar.local")
    assert client.post("/api/clientes/C001/acao", json={"formato": "email"}, headers=h).json()["fonte"] == "regras"
    r = client.post("/api/clientes/C001/acao/stream", json={"formato": "ligacao"}, headers=h)
    assert r.headers["content-type"].startswith("text/event-stream")
    assert client.post("/api/clientes/C001/acao", json={"formato": "fax"}, headers=h).status_code == 422


def test_permissoes_relatorios_e_insights(client):
    ha = _login(client, "analista@radar.local")
    hg = _login(client, "gestor@radar.local")
    r = client.get("/api/relatorios/gestor.xlsx", headers=ha)
    assert r.status_code == 403 and r.json()["erro"]["codigo"] == "nao_autorizado"
    assert client.get("/api/relatorios/analista.pdf", headers=hg).status_code == 403
    assert client.get("/api/insights/produto", headers=ha).status_code == 403
    assert client.get("/api/insights/produto", headers=hg).status_code == 200
    ok = client.get("/api/relatorios/gestor.pdf", headers=hg)
    assert ok.status_code == 200 and ok.headers["content-type"] == "application/pdf"
    assert "attachment" in ok.headers["content-disposition"]
    assert client.get("/api/relatorios/analista.xlsx", headers=ha).status_code == 200


def test_visao_gestor(client):
    ha = _login(client, "analista@radar.local")
    hg = _login(client, "gestor@radar.local")
    assert client.get("/api/gestor/visao", headers=ha).status_code == 403
    client.post("/api/clientes/C001/contato", json={}, headers=ha)
    d = client.get("/api/gestor/visao", headers=hg).json()
    k = d["kpis"]
    assert k["total_clientes"] == 2 and k["clientes_em_risco"] == 1 and k["clientes_alto_risco"] == 1
    assert k["alto_risco_contatados"] == 1 and d["cobertura"]["sem_contato"] == []
    assert d["cobertura"]["por_pessoa"][0]["contatos"] >= 1
    assert {g["valor"] for g in d["segmentos"]["porte"]} == {"Média", "Micro"}
    assert d["backlog"]["pendentes"] == 1 and sum(f["total"] for f in d["backlog"]["faixas"]) == 1
    assert d["produto"]["servicos"] == ["Portal Web", "Sistema Alfa"]
    assert d["evolucao"][-1]["mes"] == "2026-09"


def test_agente_e_modelo(client):
    h = _login(client, "gestor@radar.local")
    assert client.post("/api/agente/perguntar", json={"pergunta": "oi"}, headers=h).json()["fonte"] == "regras"
    assert client.get("/api/modelo/churn-simulado", headers=h).json()["disponivel"] is True
