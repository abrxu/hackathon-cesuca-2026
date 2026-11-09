"""Carga dos xlsx (openpyxl) em dataclasses e, opcionalmente, gravação no Postgres."""
from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta

log = logging.getLogger(__name__)


@dataclass
class Cliente:
    cliente_id: str
    nome: str
    porte: str
    setor: str
    cidade: str
    data_cadastro: date


@dataclass
class Atendimento:
    atendimento_id: str
    cliente_id: str
    data_abertura: datetime
    servico: str
    assunto: str
    canal: str
    prioridade: str
    status: str
    tempo_resolucao_min: float | None
    satisfacao: float | None


@dataclass
class Uso:
    cliente_id: str
    mes: str
    servico: str
    acessos: int
    operacoes: int


@dataclass
class Dataset:
    clientes: dict[str, Cliente]
    atendimentos: list[Atendimento]
    uso: list[Uso]


# ---------------------------------------------------------------- conversões
def _str(v) -> str:
    return "" if v is None else str(v).strip()


def _num(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", ".")
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _int(v) -> int:
    n = _num(v)
    return int(round(n)) if n is not None else 0


def _dt(v) -> datetime | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day)
    if isinstance(v, (int, float)):
        return datetime(1899, 12, 30) + timedelta(days=float(v))
    s = str(v).strip()
    try:
        return datetime.fromisoformat(s.replace("Z", ""))
    except ValueError:
        pass
    try:
        return datetime(1899, 12, 30) + timedelta(days=float(s))
    except ValueError:
        pass
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _mes(v) -> str:
    if isinstance(v, (datetime, date)):
        return f"{v.year:04d}-{v.month:02d}"
    return _str(v)[:7]


def _rows(path: str) -> list[dict]:
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        header = [_str(h) for h in next(it)]
        out = []
        for row in it:
            if row is None or all(c is None or c == "" for c in row):
                continue
            out.append(dict(zip(header, row)))
        return out
    finally:
        wb.close()


# -------------------------------------------------------------------- carga
def load_all(data_dir: str, database_url: str | None = None) -> Dataset:
    clientes: dict[str, Cliente] = {}
    for r in _rows(os.path.join(data_dir, "clientes.xlsx")):
        cid = _str(r.get("cliente_id"))
        if not cid:
            continue
        d = _dt(r.get("data_cadastro"))
        clientes[cid] = Cliente(
            cid, _str(r.get("nome_ficticio")), _str(r.get("porte")),
            _str(r.get("setor")), _str(r.get("cidade")),
            (d or datetime(2020, 1, 1)).date(),
        )

    atend: list[Atendimento] = []
    for r in _rows(os.path.join(data_dir, "atendimentos.xlsx")):
        d = _dt(r.get("data_abertura"))
        cid = _str(r.get("cliente_id"))
        if d is None or not cid:
            continue
        atend.append(Atendimento(
            _str(r.get("atendimento_id")), cid, d, _str(r.get("servico")),
            _str(r.get("assunto")), _str(r.get("canal")), _str(r.get("prioridade")),
            _str(r.get("status")), _num(r.get("tempo_resolucao_min")),
            _num(r.get("satisfacao_1_a_5")),
        ))

    uso: list[Uso] = []
    for r in _rows(os.path.join(data_dir, "uso_servicos.xlsx")):
        cid = _str(r.get("cliente_id"))
        if not cid:
            continue
        uso.append(Uso(cid, _mes(r.get("mes")), _str(r.get("servico")),
                       _int(r.get("acessos")), _int(r.get("operacoes_realizadas"))))

    ds = Dataset(clientes, atend, uso)
    if database_url:
        try:
            _gravar_postgres(ds, database_url)
        except Exception:  # noqa: BLE001 - falha de banco não derruba a API
            log.exception("Falha ao gravar no Postgres; seguindo com dados em memória")
    return ds


# ----------------------------------------------------------------- Postgres
def hash_senha(senha: str, salt: bytes | None = None, iteracoes: int = 120_000) -> str:
    """Formato: pbkdf2_sha256$<iteracoes>$<salt_hex>$<hash_hex>."""
    salt = salt or os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, iteracoes)
    return f"pbkdf2_sha256${iteracoes}${salt.hex()}${h.hex()}"


def verificar_senha(senha: str, armazenado: str) -> bool:
    try:
        _, it, salt, h = armazenado.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(salt), int(it))
        return calc.hex() == h
    except Exception:  # noqa: BLE001
        return False


_DDL = """
DROP TABLE IF EXISTS contatos, usuarios, uso_servicos, atendimentos, clientes CASCADE;
CREATE TABLE clientes (
  cliente_id TEXT PRIMARY KEY, nome TEXT, porte TEXT, setor TEXT, cidade TEXT, data_cadastro DATE);
CREATE TABLE atendimentos (
  atendimento_id TEXT PRIMARY KEY, cliente_id TEXT REFERENCES clientes(cliente_id),
  data_abertura TIMESTAMP, servico TEXT, assunto TEXT, canal TEXT, prioridade TEXT, status TEXT,
  tempo_resolucao_min DOUBLE PRECISION, satisfacao DOUBLE PRECISION);
CREATE TABLE uso_servicos (
  id SERIAL PRIMARY KEY, cliente_id TEXT REFERENCES clientes(cliente_id), mes TEXT, servico TEXT,
  acessos INTEGER, operacoes INTEGER);
CREATE TABLE contatos (
  id SERIAL PRIMARY KEY, cliente_id TEXT REFERENCES clientes(cliente_id),
  contatado_em TIMESTAMP NOT NULL DEFAULT now(), observacao TEXT, usuario_id INTEGER);
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, nome TEXT NOT NULL, papel TEXT NOT NULL,
  senha_hash TEXT NOT NULL);
"""


def _gravar_postgres(ds: Dataset, database_url: str) -> None:
    import psycopg

    with psycopg.connect(database_url, connect_timeout=5) as conn:
        with conn.cursor() as cur:
            cur.execute(_DDL)
            cur.executemany(
                "INSERT INTO clientes VALUES (%s,%s,%s,%s,%s,%s)",
                [(c.cliente_id, c.nome, c.porte, c.setor, c.cidade, c.data_cadastro)
                 for c in ds.clientes.values()])
            cur.executemany(
                "INSERT INTO atendimentos VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                [(a.atendimento_id, a.cliente_id, a.data_abertura, a.servico, a.assunto,
                  a.canal, a.prioridade, a.status, a.tempo_resolucao_min, a.satisfacao)
                 for a in ds.atendimentos if a.cliente_id in ds.clientes])
            cur.executemany(
                "INSERT INTO uso_servicos (cliente_id, mes, servico, acessos, operacoes) "
                "VALUES (%s,%s,%s,%s,%s)",
                [(u.cliente_id, u.mes, u.servico, u.acessos, u.operacoes)
                 for u in ds.uso if u.cliente_id in ds.clientes])
            cur.executemany(
                "INSERT INTO usuarios (email, nome, papel, senha_hash) VALUES (%s,%s,%s,%s)",
                [("analista@radar.local", "Ana Analista", "analista", hash_senha("radar123")),
                 ("gestor@radar.local", "Gustavo Gestor", "gestor", hash_senha("radar123"))])
        conn.commit()
