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
- Estilização: Tailwind CSS 4. Os tokens (cores, fonte, tamanhos) ficam no `@theme` de `frontend/src/index.css` e os componentes visuais em `frontend/src/components/ui.jsx`. Quando o design system chegar em `frontend/design/`, a adaptação começa por esses dois arquivos.
- Fonte Archivo empacotada via npm (`@fontsource-variable/archivo`), sem depender de internet.

### Telas do frontend

| Rota | Tela |
|---|---|
| `/login` | Entrada (analista ou gestor) |
| `/` | Painel: KPIs, prioridade de contato, distribuição de risco, chamados por serviço |
| `/clientes` | Clientes em risco: busca, filtros e ordenação (filtros ficam na URL) |
| `/clientes/:id` | Cliente 360: score, explicação por faceta, uso mensal, histórico; abre o painel de ação sugerida |
| `/chamados` | Fila de chamados: ordem inteligente x ordem de chegada |

A camada `frontend/src/api/client.js` segue `docs/api-contract.md`. Enquanto uma rota ainda não existe no backend (404/405/501) ou o backend está fora do ar, ela responde com dados de exemplo de `frontend/src/api/mock.js`, no mesmo formato do contrato. No login de exemplo, e-mails com "gestor" entram como gestor; qualquer outro, como analista.

## Limitações conhecidas

- O frontend usa dados de exemplo nas rotas que o backend ainda não implementou; os números exibidos nesses casos não vêm das planilhas.
- Telas de insights de produto, relatórios e agente de análise (previstas no contrato) ainda não existem no frontend.
