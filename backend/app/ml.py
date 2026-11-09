"""Perfis de risco (k-means com fallback por regras) e modelo de churn simulado."""
from __future__ import annotations

import logging
import warnings

from .scoring import ClienteRisco

log = logging.getLogger(__name__)

PERFIS = ("silencioso", "frustrado", "travado", "saudavel")
_CHURN_INFO: dict | None = None


def _notas(r: ClienteRisco) -> tuple[int, int, int]:
    f = r.facetas
    return f["engajamento"].nota, f["atrito"].nota, f["satisfacao"].nota


def _perfil_regras(r: ClienteRisco) -> str:
    e, a, s = _notas(r)
    if r.score < 40 and max(e, a, s) < 60:
        return "saudavel"
    if r.pendentes_alta > 0 and a >= max(e, s):
        return "travado"
    if e >= 50 and a < 40 and s < 70:
        return "silencioso"
    if s >= 50 or a >= 50:
        return "frustrado" if s >= a - 10 else "travado"
    if e >= 50:
        return "silencioso"
    return "saudavel"


def _afinidade(nome: str, c) -> float:
    e, a, s = c
    if nome == "silencioso":
        return e - a - 0.3 * s
    if nome == "frustrado":
        return s - 0.3 * e + 0.2 * a
    if nome == "travado":
        return a - 0.3 * s
    return -(e + a + s)


def assign_profiles(riscos: dict[str, ClienteRisco]) -> None:
    if not riscos:
        return
    try:
        import numpy as np
        from itertools import permutations
        from sklearn.cluster import KMeans

        ids = list(riscos)
        X = np.array([_notas(riscos[i]) for i in ids], dtype=float)
        km = KMeans(n_clusters=4, random_state=42, n_init=10).fit(X)
        cents = km.cluster_centers_
        melhor, melhor_val = None, -1e18
        for perm in permutations(PERFIS):
            val = sum(_afinidade(perm[k], cents[k]) for k in range(4))
            if val > melhor_val:
                melhor, melhor_val = perm, val
        for i, lab in zip(ids, km.labels_):
            riscos[i].perfil = melhor[int(lab)]
        # coerência: cliente sem nenhuma faceta relevante e score baixo é saudável
        for r in riscos.values():
            if r.score < 30 and max(_notas(r)) < 60:
                r.perfil = "saudavel"
    except Exception:  # noqa: BLE001
        log.exception("KMeans falhou; usando perfis por regras")
        for r in riscos.values():
            r.perfil = _perfil_regras(r)


def train_churn_sim(seed: int = 42):
    global _CHURN_INFO
    try:
        import numpy as np
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import train_test_split

        rng = np.random.default_rng(seed)
        n = 2000
        X = rng.uniform(0, 100, size=(n, 3))  # engajamento, atrito, satisfacao
        z = (0.050 * X[:, 0] + 0.040 * X[:, 1] + 0.025 * X[:, 2] - 5.5
             + rng.normal(0, 0.5, n))
        p = 1 / (1 + np.exp(-z))
        y = (rng.uniform(size=n) < p).astype(int)
        Xtr, Xte, ytr, yte = train_test_split(X / 100, y, test_size=0.25, random_state=seed)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            modelo = LogisticRegression(max_iter=500).fit(Xtr, ytr)
        _CHURN_INFO = {
            "amostras": n,
            "acuracia": round(float(modelo.score(Xte, yte)), 3),
            "coeficientes": {k: round(float(c), 2) for k, c in
                             zip(("engajamento", "atrito", "satisfacao"), modelo.coef_[0])},
        }
        return modelo
    except Exception:  # noqa: BLE001
        log.exception("Falha ao treinar churn simulado")
        _CHURN_INFO = None
        return None


def churn_sim_info() -> dict | None:
    return _CHURN_INFO
