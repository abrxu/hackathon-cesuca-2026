import os

import pytest

from app import ai, reports


class FakeStore:
    ds = None

    def __init__(self):
        self.item = {"cliente_id": "C001", "nome": "Empresa 001", "porte": "Média", "setor": "Comércio", "cidade": "Canoas",
                     "score": 88, "faixa": "alto", "perfil": "frustrado", "motivo_principal": "Operações caíram 62%",
                     "pendentes": 2, "satisfacao_media": None, "contatado_em": None}

    def cliente_detalhe(self, cid):
        return {"cliente": {"nome": "Empresa 001", "porte": "Média", "setor": "Comércio", "cidade": "Canoas", "meses_de_casa": 3},
                "score": 88, "faixa": "alto", "perfil": "frustrado",
                "facetas": {"engajamento": {"nota": 90, "peso": 0.4, "contribuicao": 36, "descricao": "Queda de uso"},
                            "atrito": {"nota": 80, "peso": 0.35, "contribuicao": 28, "descricao": "2 pendentes"},
                            "satisfacao": {"nota": 96, "peso": 0.25, "contribuicao": 24, "descricao": "Sem nota"}},
                "contexto": {"impacto": "Média", "sinais": ["cliente_recente"]},
                "uso": [{"mes": "2026-09", "servico": "Portal Web", "acessos": 10, "operacoes": 20}],
                "atendimentos": [{"servico": "Portal Web", "assunto": "Lentidão", "status": "Pendente", "satisfacao": None,
                                  "tempo_resolucao_min": None}], "contatado_em": None}

    def listar(self, **f):
        return [self.item]

    def painel(self):
        return {"kpis": {"clientes_alto_risco": 1, "atendimentos_pendentes": 2, "pendentes_prioridade_alta": 1,
                         "satisfacao_media": None, "tempo_medio_resolucao_min": None},
                "distribuicao": {"alto": 1, "atencao": 0, "saudavel": 0}, "perfis": {"frustrado": 1}}


@pytest.fixture(autouse=True)
def sem_chave(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)


def test_sugerir_acao_regras():
    r = ai.sugerir_acao(FakeStore(), "C001", "ligacao")
    assert r["fonte"] == "regras"
    assert r["resumo"] and r["proximo_passo"] and isinstance(r["roteiro"], list) and r["roteiro"]
    assert r["baseado_em"] == {"atendimentos": 1, "meses_de_uso": 1}


def test_stream_eventos():
    out = "".join(ai.sugerir_acao_stream(FakeStore(), "C001", "email"))
    assert out.startswith("event: meta") and "event: delta" in out and "event: fim" in out


def test_agente_regras():
    r = ai.perguntar(FakeStore(), "quais clientes frustrados?", "analista")
    assert r["fonte"] == "regras" and r["ferramentas_usadas"] == ["listar_clientes"]
    assert "event: fim" in "".join(ai.perguntar_stream(FakeStore(), "oi", "gestor"))
    assert ai.resumo_executivo(FakeStore())


def test_relatorios():
    s = FakeStore()
    assert reports.relatorio_analista_xlsx(s, {}).startswith(b"PK")
    assert reports.relatorio_gestor_xlsx(s).startswith(b"PK")
    assert reports.relatorio_analista_pdf(s, {}).startswith(b"%PDF")
    assert reports.relatorio_gestor_pdf(s).startswith(b"%PDF")
