# Backend: módulos e interfaces internas

Contrato interno entre os módulos de `backend/app/`. O contrato externo (HTTP) está em [api-contract.md](api-contract.md).

## Fluxo

```
startup (main.py)
  └─ data.load_all(DATA_DIR)            → Dataset (xlsx → dataclasses, grava no Postgres)
  └─ scoring.compute_all(dataset)       → dict[cliente_id, ClienteRisco]
  └─ ml.assign_profiles(riscos)         → preenche ClienteRisco.perfil (k-means, fallback regras)
  └─ ml.train_churn_sim()               → modelo simulado (opcional, nunca bloqueia)
  └─ app.state.store = Store(dataset, riscos)
rotas (routes/*.py) leem app.state.store; ai.py e reports.py recebem Store
```

## Módulo `app/data.py` (frente 1)

```python
@dataclass
class Cliente: cliente_id: str; nome: str; porte: str; setor: str; cidade: str; data_cadastro: date
@dataclass
class Atendimento: atendimento_id: str; cliente_id: str; data_abertura: datetime; servico: str; assunto: str; canal: str; prioridade: str; status: str; tempo_resolucao_min: float | None; satisfacao: float | None
@dataclass
class Uso: cliente_id: str; mes: str; servico: str; acessos: int; operacoes: int
@dataclass
class Dataset: clientes: dict[str, Cliente]; atendimentos: list[Atendimento]; uso: list[Uso]

def load_all(data_dir: str, database_url: str | None) -> Dataset
```
- Lê xlsx com `openpyxl` (sem pandas). `data_cadastro` é serial do Excel (dias desde 1899-12-30) ou data; converter.
- Vazio vira `None`, nunca 0.
- Se `database_url` existir: `DROP`+`CREATE` das tabelas `clientes`, `atendimentos`, `uso_servicos`, `contatos`, `usuarios` e insere tudo. Seed de usuários: `analista@radar.local` (Ana Analista, analista) e `gestor@radar.local` (Gustavo Gestor, gestor), senha `radar123` (hash com `hashlib.pbkdf2_hmac`). Falha no banco é logada e não derruba a API.

## Módulo `app/scoring.py` (frente 1)

```python
@dataclass
class Faceta: nota: int; peso: float; contribuicao: int; descricao: str
@dataclass
class ClienteRisco:
    cliente_id: str; score: int; faixa: str            # "alto" | "atencao" | "saudavel"
    perfil: str                                         # preenchido por ml.assign_profiles
    facetas: dict[str, Faceta]                          # chaves: engajamento, atrito, satisfacao
    motivo_principal: str
    uso_total: list[dict]                               # [{mes, acessos, operacoes}] ordenado
    pendentes: int; pendentes_alta: int; satisfacao_media: float | None
    sinais: list[str]                                   # ex.: "cliente_recente", "assunto_recorrente:Lentidão"
    meses_de_casa: int

PESOS = {"engajamento": 0.40, "atrito": 0.35, "satisfacao": 0.25}
IMPACTO = {"Micro": 1, "Pequena": 2, "Média": 3}

def compute_all(ds: Dataset) -> dict[str, ClienteRisco]
def prioridade_key(r: ClienteRisco, c: Cliente) -> tuple       # (-score, -IMPACTO[porte])
def faixa_de(score: int) -> str                                 # ≥70 alto, 40–69 atencao, <40 saudavel
def insights_produto(ds: Dataset) -> list[dict]                 # formato de /insights/produto
def prioridade_sugerida(at: Atendimento, r: ClienteRisco, ref: datetime) -> tuple[str, str]  # (Normal|Alta|Crítica, motivo)
```
- Engajamento: variação jul→set do total do cliente, 60% operações + 40% acessos; queda vira nota 0–100.
- Atrito: pendentes, pendentes de prioridade alta, volume de atendimentos.
- Satisfação: média das notas existentes (1→100, 5→0); sem nota → nota neutra e descrição dizendo isso.
- `contribuicao = round(nota * peso)`; ajustar a maior para a soma bater com `score` exatamente.
- Data de referência = maior `data_abertura` do dataset.

## Módulo `app/ml.py` (frente 1)

```python
def assign_profiles(riscos: dict[str, ClienteRisco]) -> None    # silencioso | frustrado | travado | saudavel
def train_churn_sim(seed: int = 42) -> object | None             # LogisticRegression em ~2000 linhas sintéticas em memória
def churn_sim_info() -> dict | None                              # {"amostras", "acuracia", "coeficientes"}
```
- K-means (`scikit-learn`, k=4, `random_state=42`) sobre as notas das 3 facetas; nomear clusters pelo centróide. Qualquer exceção → perfis por regras.

## Módulo `app/auth.py` (frente 2)

```python
def login(email: str, senha: str) -> dict | None   # {"token", "usuario"}
def current_user(...) -> dict                      # dependência FastAPI; 401 nao_autenticado
def require_role(papel: str)                       # dependência; 403 nao_autorizado
```
JWT com `PyJWT`, HS256, `JWT_SECRET`, expiração 12 h.

## Módulo `app/ai.py` (frente 3)

```python
def sugerir_acao(store, cliente_id: str, formato: str) -> dict            # formato do contrato; nunca lança
def sugerir_acao_stream(store, cliente_id: str, formato: str) -> Iterator[str]   # eventos SSE
def perguntar(store, pergunta: str, papel: str) -> dict
def perguntar_stream(store, pergunta: str, papel: str) -> Iterator[str]
def resumo_executivo(store) -> str
```
- SDK `openai` com `base_url=DEEPSEEK_BASE_URL`, `api_key=DEEPSEEK_API_KEY`, `model=DEEPSEEK_MODEL`, timeout 8 s.
- Sem chave ou qualquer erro → texto por regras com `fonte: "regras"`.
- Agente: tool calling com funções fixas `listar_clientes`, `detalhe_cliente`, `resumo_carteira`, `insights_produto` (esta só para gestor).

## Módulo `app/reports.py` (frente 3)

```python
def relatorio_analista_xlsx(store, filtros: dict) -> bytes
def relatorio_analista_pdf(store, filtros: dict) -> bytes
def relatorio_gestor_xlsx(store) -> bytes
def relatorio_gestor_pdf(store) -> bytes
```
`openpyxl` e `reportlab`. Os PDFs seguem a identidade visual do sistema (paleta de `frontend/src/index.css`: azul-noite, vermelho/âmbar/verde de risco, roxo da IA; faixa de marca no topo, rodapé com data e página, fonte Helvetica por ser embutida no PDF). Se os tokens do frontend mudarem, atualizar as constantes de cor no início do bloco PDF de `reports.py`.

## `Store` (em `app/store.py`, frente 2)

```python
class Store:
    ds: Dataset; riscos: dict[str, ClienteRisco]; contatos: dict[str, datetime]
    def cliente_resumo(self, cid) -> dict        # ClienteResumo do contrato
    def cliente_detalhe(self, cid) -> dict       # resposta de GET /clientes/{id}
    def listar(self, **filtros) -> list[dict]
    def painel(self) -> dict
    def visao_gestor(self) -> dict               # resposta de GET /gestor/visao
    def fila(self, ordem, **filtros) -> list[dict]
    def marcar_contato(self, cid, observacao) -> datetime
```
