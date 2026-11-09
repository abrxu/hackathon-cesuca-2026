import os
from pathlib import Path

import pytest

from app import data, ml, scoring

_DEFAULT = Path(__file__).resolve().parents[2] / "docs-hackathon" / "Arquivos de trabalho"
DATA_DIR = os.environ.get("DATA_DIR") or str(_DEFAULT)


@pytest.fixture(scope="module")
def ds():
    return data.load_all(DATA_DIR, None)


@pytest.fixture(scope="module")
def riscos(ds):
    r = scoring.compute_all(ds)
    ml.assign_profiles(r)
    return r


def test_carga(ds):
    assert len(ds.clientes) == 100
    assert len(ds.atendimentos) == 300
    assert len(ds.uso) == 300
    pend = [a for a in ds.atendimentos if a.status == "Pendente"]
    assert pend and all(a.satisfacao is None and a.tempo_resolucao_min is None for a in pend)


def test_compute_all(ds, riscos):
    assert len(riscos) == 100
    for r in riscos.values():
        assert 0 <= r.score <= 100
        assert sum(f.contribuicao for f in r.facetas.values()) == r.score
        assert r.faixa == scoring.faixa_de(r.score)
        assert len(r.uso_total) == 3
        assert r.perfil in ("silencioso", "frustrado", "travado", "saudavel")
        assert r.motivo_principal


def test_ml():
    assert ml.train_churn_sim() is not None
    info = ml.churn_sim_info()
    assert info["amostras"] == 2000 and 0 < info["acuracia"] <= 1


def test_insights(ds):
    assert isinstance(scoring.insights_produto(ds), list)
