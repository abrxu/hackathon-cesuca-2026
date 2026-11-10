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

   Preencha `DEEPSEEK_API_KEY` para a IA (modelo `deepseek-flash`). Sem a chave, a ação sugerida, o agente e o resumo executivo respondem por regras.

2. Suba a aplicação:

   ```bash
   docker compose up --build
   ```

3. Acesse:
   - Frontend: http://localhost:5173
   - API: http://localhost:8000 (verificação de saúde em http://localhost:8000/api/health, documentação interativa em http://localhost:8000/docs)

4. Usuários de teste (senha `radar123`): `analista@radar.local` (Analista de CS) e `gestor@radar.local` (Gestor).

Na subida, o backend lê os 3 xlsx de `docs-hackathon/Arquivos de trabalho/` (montados em `/data`), recria as tabelas no Postgres, calcula o score de risco e os perfis e treina o modelo de churn simulado. Contrato HTTP: [docs/api-contract.md](docs/api-contract.md).

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
| `backend/` | FastAPI + psycopg; `app/data.py` (carga), `scoring.py` (score e facetas), `ml.py` (perfis k-means e churn simulado), `ai.py` (DeepSeek com fallback), `reports.py` (xlsx/pdf), `routes/` |
| `docs/` | Contrato da API e interfaces internas do backend |
| `docs-hackathon/` | Regulamento, desafio e planilhas de dados |
| `.claude/skills/` | Skills do Claude Code usadas no projeto (ex.: `frontend-design`) |

## Desenvolvimento

- Apenas `frontend/src` e `backend/app` são sincronizados com os containers (recarregam sozinhos).
- Alterações em `package.json`, `vite.config.js`, `requirements.txt` ou nos Dockerfiles exigem `docker compose up --build`.
- Testes do backend: `docker compose exec -e DATA_DIR=/data backend python -m pytest -q /code/tests`.
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
| `/gestor` | Visão do gestor (só papel gestor): 3 indicadores (carteira em risco, alto risco já contatado, chamados há mais de 30 dias), perfis com ação em escala, top 3 de atrito do produto (serviço × assunto), relatórios em PDF/Excel para a diretoria |

A camada `frontend/src/api/client.js` segue `docs/api-contract.md`. Enquanto uma rota ainda não existe no backend (404/405/501) ou o backend está fora do ar, ela responde com dados de exemplo de `frontend/src/api/mock.js`, no mesmo formato do contrato. No login de exemplo (só sem backend), e-mails com "gestor" entram como gestor; qualquer outro, como analista.

## Deploy (produção)

- URL: https://hackathon.abrxu.com (API em `/api`, docs em `/docs`). Logins de demo: `analista@radar.local` e `gestor@radar.local`, senha `radar123`.
- Todo push na `main` dispara `.github/workflows/deploy.yml`: o Actions conecta na VPS com o usuário `deploy` usando uma chave restrita ao `/opt/hackathon/deploy.sh`, que faz checkout do commit e roda `docker compose -f deploy/compose.prod.yml up -d --build`.
- Os slides do pitch (`docs/pitch-guia.html`) são servidos em https://hackathon.abrxu.com/slides: o `compose.prod.yml` monta o arquivo no nginx do frontend. Atualizou o HTML, é só dar push na `main`.
- O `.env` de produção é montado a partir dos secrets do repositório (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `DEEPSEEK_API_KEY`); para trocar um valor, altere o secret e rode o workflow de novo (aba Actions → Deploy → Run workflow). Os secrets `DEPLOY_*` guardam a chave SSH e o host.
- Na VPS, o Caddy compartilhado (`/opt/classbuddy/Caddyfile`) tem o bloco `hackathon.abrxu.com`, apontando para os containers `hackathon-frontend` e `hackathon-backend` na rede `classbuddy_internal`. O DNS passa pelo proxy da Cloudflare.

## Limitações conhecidas

- O score de risco é um sinal calculado por regras (engajamento, atrito, satisfação), não uma previsão de cancelamento: os dados não têm rótulo de churn.
- O uso de serviços tem 3 meses e cada mês pode ser de um serviço diferente; o engajamento compara o uso total do cliente.
- O modelo de churn é treinado com dados sintéticos em memória e serve só como prova de conceito do próximo passo.
- Login com 2 usuários fixos de teste; contatos marcados ficam em memória (e no Postgres) e somem ao reiniciar o backend.
- `perguntar/stream` do agente fatia a resposta pronta em vez de transmitir token a token.
- Horários gravados pelo backend estão em UTC.
- O frontend cai para dados de exemplo (`frontend/src/api/mock.js`) só quando uma rota não existe ou o backend está fora do ar; nesse caso os números não vêm das planilhas.
- Telas de insights de produto, relatórios e agente de análise (previstas no contrato) ainda não existem no frontend.
