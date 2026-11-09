# Hackathon Data Cempro Cesuca 2026

Protótipo com React (Vite + Tailwind CSS) no frontend, FastAPI no backend e PostgreSQL como banco de dados.

## Requisitos

- Docker e Docker Compose
- Node.js 22+ (opcional, apenas para desenvolver o frontend fora do Docker)

## Como executar

1. Crie o arquivo de variáveis de ambiente:

   ```bash
   cp .env.example .env
   ```

2. Suba a aplicação:

   ```bash
   docker compose up --build
   ```

3. Acesse:
   - Frontend: http://localhost:5173
   - API: http://localhost:8000 (verificação de saúde em http://localhost:8000/api/health)

### Erro `additional privileges requested: pass "--allow=fs.read=..."`

Versões recentes do Docker (29+), principalmente no Windows, podem bloquear o build com esse erro. Defina a variável abaixo e rode novamente:

```bash
# Bash / Git Bash
BUILDX_BAKE_ENTITLEMENTS_FS=0 docker compose up --build
```

```powershell
# PowerShell
$env:BUILDX_BAKE_ENTITLEMENTS_FS = "0"; docker compose up --build
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `frontend/` | React 18 + Vite 5 + Tailwind CSS 4 |
| `backend/` | FastAPI + psycopg |
| `docs-hackathon/` | Regulamento, desafio e planilhas de dados |
| `.claude/skills/` | Skills do Claude Code usadas no projeto (ex.: `frontend-design`) |

## Desenvolvimento

- Apenas `frontend/src` e `backend/app` são sincronizados com os containers (recarregam sozinhos).
- Alterações em `package.json`, `vite.config.js`, `requirements.txt` ou nos Dockerfiles exigem `docker compose up --build`.
- Estilização: classes utilitárias do Tailwind; o ponto de entrada é `frontend/src/index.css`.

## Limitações conhecidas

- Protótipo em estágio inicial: a interface ainda exibe apenas a verificação de saúde da API.
