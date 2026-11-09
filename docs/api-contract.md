# Contrato da API

Fonte da verdade entre backend (FastAPI) e frontend (React). Mudou aqui, avisa o outro time antes de mudar o código.

- Base: `http://localhost:8000/api`
- Formato: JSON, `snake_case`, datas em ISO 8601 (`2026-09-14T10:22:00`), meses como `"2026-09"`.
- Autenticação: `Authorization: Bearer <token>` em todas as rotas exceto `/auth/login` e `/health`.
- Termos seguem o [GLOSSARY.md](../GLOSSARY.md).

## Convenções

**Valor ausente é `null`, nunca `0`.** Atendimentos pendentes têm `tempo_resolucao_min: null` e `satisfacao: null`. O frontend exibe `—`.

**Enums**

| Tipo | Valores |
|---|---|
| `Papel` | `"analista"`, `"gestor"` |
| `Faixa` | `"alto"` (score ≥ 70), `"atencao"` (40–69), `"saudavel"` (< 40) |
| `Perfil` | `"silencioso"`, `"frustrado"`, `"travado"`, `"saudavel"` |
| `Porte` | `"Micro"`, `"Pequena"`, `"Média"` |
| `Servico` | `"Sistema Alfa"`, `"Sistema Beta"`, `"Portal Web"`, `"Aplicativo Mobile"` |
| `Prioridade` | `"Baixa"`, `"Normal"`, `"Alta"` |
| `PrioridadeSugerida` | `"Normal"`, `"Alta"`, `"Crítica"` |
| `StatusAtendimento` | `"Resolvido"`, `"Pendente"` |
| `FormatoAcao` | `"ligacao"`, `"email"`, `"whatsapp"` |
| `FonteTexto` | `"ia"`, `"regras"` (fallback quando a IA não responde) |

**Erro** (qualquer status 4xx/5xx):

```json
{ "erro": { "codigo": "nao_autorizado", "mensagem": "Sessão expirada. Entre novamente." } }
```

Códigos: `nao_autenticado` (401), `nao_autorizado` (403), `nao_encontrado` (404), `parametro_invalido` (422), `erro_interno` (500).

## Permissões

| Rota | Analista | Gestor |
|---|---|---|
| Painel, clientes, cliente 360, ação sugerida, fila | ✔ | ✔ |
| Marcar contato | ✔ | ✔ |
| Insights de produto | — | ✔ |
| Relatório do analista (para o gestor) | ✔ | — |
| Relatório do gestor (para a diretoria) | — | ✔ |
| Agente de análise | ✔ | ✔ (com ferramentas de carteira inteira) |

---

## Rotas

### `GET /health`
```json
{ "status": "ok", "db": "PostgreSQL 16.x" }
```

### `POST /auth/login`
Request:
```json
{ "email": "analista@radar.local", "senha": "..." }
```
Response `200`:
```json
{ "token": "eyJ...", "usuario": { "id": 1, "nome": "Ana Analista", "papel": "analista" } }
```
Usuários de teste ficam no seed do banco e no README.

### `GET /me`
```json
{ "id": 1, "nome": "Ana Analista", "papel": "analista" }
```

### `GET /painel`
```json
{
  "kpis": {
    "clientes_alto_risco": 14,
    "clientes_alto_risco_variacao": 4,
    "atendimentos_pendentes": 40,
    "pendentes_prioridade_alta": 9,
    "satisfacao_media": 3.6,
    "tempo_medio_resolucao_min": 252
  },
  "distribuicao": { "alto": 14, "atencao": 26, "saudavel": 60 },
  "perfis": { "silencioso": 11, "frustrado": 9, "travado": 6, "saudavel": 74 },
  "prioridade_hoje": [ /* ClienteResumo[], top 5 */ ],
  "atendimentos_por_servico": [ { "servico": "Sistema Alfa", "total": 92, "pendentes": 14 } ]
}
```

### `GET /clientes`
Query (todos opcionais): `busca`, `faixa`, `perfil`, `porte`, `setor`, `cidade`, `servico`, `ordenar` (`prioridade` padrão | `score` | `nome`), `direcao` (`desc` padrão | `asc`).

`prioridade` = score ordenado com desempate pelo impacto (porte).

Response:
```json
{ "total": 18, "itens": [ /* ClienteResumo[] */ ] }
```

**ClienteResumo**
```json
{
  "cliente_id": "C037",
  "nome": "Empresa Exemplo 037",
  "porte": "Média",
  "setor": "Comércio",
  "cidade": "Canoas",
  "score": 88,
  "faixa": "alto",
  "perfil": "frustrado",
  "motivo_principal": "Operações caíram 62% desde julho",
  "uso_total": [ { "mes": "2026-07", "acessos": 410, "operacoes": 1220 }, { "mes": "2026-08", "acessos": 300, "operacoes": 800 }, { "mes": "2026-09", "acessos": 160, "operacoes": 460 } ],
  "pendentes": 2,
  "satisfacao_media": 2.0,
  "contatado_em": null
}
```

### `GET /clientes/{cliente_id}`
```json
{
  "cliente": { "cliente_id": "C037", "nome": "Empresa Exemplo 037", "porte": "Média", "setor": "Comércio", "cidade": "Canoas", "data_cadastro": "2023-03-14", "meses_de_casa": 31 },
  "score": 88,
  "faixa": "alto",
  "perfil": "frustrado",
  "facetas": {
    "engajamento": { "nota": 90, "peso": 0.4, "contribuicao": 36, "descricao": "Operações caíram 62% e acessos 61% entre jul e set" },
    "atrito":      { "nota": 80, "peso": 0.35, "contribuicao": 28, "descricao": "2 pendentes, 1 de prioridade alta" },
    "satisfacao":  { "nota": 96, "peso": 0.25, "contribuicao": 24, "descricao": "Nota média 2,0 nos últimos 3 atendimentos" }
  },
  "contexto": {
    "impacto": "Média",
    "sinais": ["cliente_recente", "assunto_recorrente:Lentidão"]
  },
  "uso": [ { "mes": "2026-07", "servico": "Sistema Alfa", "acessos": 410, "operacoes": 1220 } ],
  "atendimentos": [ /* Atendimento[], mais recente primeiro */ ],
  "contatado_em": null
}
```
`facetas[*].contribuicao` somadas = `score`. `uso` tem um registro por mês; cada mês pode ser de um serviço diferente.

**Atendimento**
```json
{
  "atendimento_id": "A0287",
  "cliente_id": "C037",
  "data_abertura": "2026-09-14T10:22:00",
  "servico": "Sistema Alfa",
  "assunto": "Lentidão",
  "canal": "WhatsApp",
  "prioridade": "Alta",
  "status": "Pendente",
  "tempo_resolucao_min": null,
  "satisfacao": null
}
```

### `POST /clientes/{cliente_id}/acao`
Request:
```json
{ "formato": "ligacao" }
```
Response (2–8 s com IA; instantâneo no fallback):
```json
{
  "fonte": "ia",
  "resumo": "Cliente de porte médio do comércio...",
  "proximo_passo": "Ligar hoje e resolver o atendimento de lentidão primeiro.",
  "roteiro": ["Vimos que a lentidão no Sistema Alfa...", "Perguntar quais rotinas...", "Oferecer sessão de 30 min..."],
  "baseado_em": { "atendimentos": 5, "meses_de_uso": 3 }
}
```
Nunca retorna erro por falha da IA: cai para `fonte: "regras"` com o mesmo formato.

### `POST /clientes/{cliente_id}/contato`
Request: `{ "observacao": "Ligação feita, agendada revisão" }` (opcional)
Response: `{ "cliente_id": "C037", "contatado_em": "2026-11-09T20:40:00" }`

### `GET /atendimentos/fila`
Query: `ordem` (`inteligente` padrão | `chegada`), `servico`, `assunto`, `canal`.
```json
{
  "total": 40,
  "itens": [
    {
      "posicao": 1,
      "atendimento": { /* Atendimento */ },
      "cliente": { "cliente_id": "C037", "nome": "Empresa Exemplo 037", "score": 88, "faixa": "alto" },
      "prioridade_sugerida": "Crítica",
      "dias_aberto": 26,
      "motivo": "Cliente em alto risco"
    }
  ]
}
```

### `GET /insights/produto` (gestor)
```json
{
  "itens": [
    { "servico": "Sistema Alfa", "assunto": "Lentidão", "atendimentos": 31, "satisfacao_media": 2.4, "clientes_afetados": 22, "descricao": "Sistema Alfa concentra 41% dos atendimentos de lentidão" }
  ]
}
```

### `GET /relatorios/analista.{xlsx|pdf}` (analista → gestor)
Carteira do analista com os filtros da query de `/clientes`: score, facetas, perfil, ação sugerida, contatos feitos no período. Retorna o arquivo (`Content-Disposition: attachment`).

### `GET /relatorios/gestor.{xlsx|pdf}` (gestor → diretoria)
Visão consolidada: KPIs, distribuição por faixa e perfil, evolução, top clientes em risco, insights de produto e resumo executivo do agente. Mais resumido que o do analista.

### `POST /agente/perguntar`
Request:
```json
{ "pergunta": "Quais clientes de comércio estão frustrados?" }
```
Response:
```json
{
  "fonte": "ia",
  "resposta": "Encontrei 4 clientes de comércio com perfil frustrado...",
  "ferramentas_usadas": ["listar_clientes"],
  "clientes": [ /* ClienteResumo[] opcional */ ]
}
```
### Streaming (SSE)

`POST /clientes/{cliente_id}/acao/stream` e `POST /agente/perguntar/stream` recebem o mesmo corpo das versões normais e respondem `text/event-stream`:

```
event: meta
data: {"fonte": "ia"}

event: delta
data: {"texto": "Cliente de porte médio "}

event: fim
data: { /* mesmo JSON da versão sem stream */ }
```
No fallback por regras vem `meta` com `"fonte": "regras"`, um único `delta` e o `fim`. Como é POST, use `fetch` + `ReadableStream` no frontend (não `EventSource`).

### Modelo de churn simulado

### `GET /modelo/churn-simulado`
```json
{ "disponivel": true, "amostras": 2000, "acuracia": 0.81, "coeficientes": { "engajamento": 1.9, "atrito": 1.2, "satisfacao": 0.8 } }
```

O agente só chama funções fixas do backend (`listar_clientes`, `detalhe_cliente`, `resumo_carteira`, `insights_produto`); nunca gera SQL.
