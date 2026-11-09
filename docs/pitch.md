# Pitch: Radar de Clientes

Material de apoio para montar a apresentação de 5 minutos. Vocabulário em [GLOSSARY.md](../GLOSSARY.md).

## Descrição em 5 frases (entregável obrigatório)

1. Empresas de software B2B perdem clientes sem perceber a tempo: antes de cancelar, o cliente para de usar o sistema, acumula chamados e dá notas baixas, mas esses sinais ficam espalhados em bases diferentes.
2. O Radar de Clientes junta uso, atendimentos e cadastro em um score de risco explicável, separado em três facetas: engajamento, atrito e satisfação.
3. O Analista de Customer Success recebe todo dia a lista de quem contatar primeiro e, para cada cliente, uma ação sugerida com roteiro escrito por IA.
4. O Gestor acompanha a carteira, vê onde o produto gera mais problemas e exporta relatórios em Excel e PDF para a diretoria.
5. O score é feito por regras auditáveis, a IA só explica e escreve, e sem internet o sistema continua funcionando com sugestões por regras.

## Roteiro (5 min)

| Tempo | Conteúdo |
|---|---|
| 0:00–1:00 | **Problema e público.** Retenção é a receita de quem vende software por assinatura. Os sinais existem nos dados, mas ninguém junta. Público: Analista de CS (L1) e Gestor (L2). |
| 1:00–4:00 | **Demo.** Login do analista → painel ("10 clientes em alto risco") → lista ordenada → cliente C022 (score 98: as facetas somam o score) → "Gerar ação sugerida" (roteiro de ligação pela IA) → "Marcar como contatado" (fica registrado quem e quando). Login do gestor → insights de produto → baixar relatório PDF para a diretoria. |
| 4:00–5:00 | **Resultados, limitações e próximo passo.** Números abaixo, limitações honestas e integração com o helpdesk real. |

## Frases que conectam com a Data Cempro

- "A Data Cempro vende tecnologia que vem com gente junto; o Radar diz a essa gente com quem falar primeiro hoje e por quê."
- "Um escritório de contabilidade que para de usar o sistema antes de cancelar deixa rastro: queda de uso, chamados parados, nota baixa. Juntamos os três num score que qualquer analista entende."
- "A IA não decide nada: o score é regra auditável, e a IA só escreve o roteiro do contato. Sem internet, o roteiro sai por regras e a demo continua."

## Números reais dos dados (para citar)

- 100 clientes, 300 atendimentos, 3 meses de uso (jul a set/2026).
- 40 atendimentos pendentes, 13 de prioridade alta.
- Distribuição de risco: 10 alto, 38 atenção, 52 saudáveis.
- Perfis: 30 silenciosos, 19 frustrados, 10 travados, 41 saudáveis.
- Ação sugerida pela IA: cerca de 4 s; fallback por regras: instantâneo.

**Não citar** a acurácia do modelo de churn simulado (0,76): os rótulos são sintéticos e gerados com as mesmas facetas, então o número não mede nada real. Apresentar só como "pipeline pronto para receber histórico real".

## Por que essas escolhas

| Escolha | Alternativa descartada | Por quê |
|---|---|---|
| Retenção de clientes como problema | Só dashboard; só fila de suporte; upsell | Usa os 3 arquivos, gera ação concreta e é a dor de quem vende software por assinatura com suporte humano. |
| Score por regras com facetas | Modelo de ML treinado | Não existe rótulo de churn nos dados; 100 clientes e 3 meses não sustentam treino; regras são explicáveis para quem age. |
| Score = soma das facetas | Número único opaco | O analista vê o porquê de cada ponto; a banca pode auditar. |
| Porte só desempata | Porte aumenta o risco | Um cliente pequeno com o mesmo comportamento tem o mesmo risco; o porte define quem atender antes. |
| Engajamento pelo uso total do cliente | Uso por serviço | Cada mês do arquivo de uso registra um serviço diferente; comparar serviço a serviço seria falso. |
| Perfis (silencioso, frustrado, travado) | Só faixa de risco | Cada perfil pede uma ação diferente: reengajar, escalar suporte, destravar pendência. |
| IA só explica e escreve | IA decide o risco | Decisão auditável fica nas regras; a IA acelera o trabalho do analista. |
| Agente com funções fixas | Chat que gera SQL | Mais seguro e não quebra ao vivo. |
| Dois papéis com login | Acesso único | Separa operação (analista) de gestão (gestor); a diretoria recebe relatório, não acessa o sistema. |

## Perguntas prováveis da banca

**CEO (processos, papéis, governança)**
- *Quem usa e em que rotina?* O analista abre a lista de prioridade toda manhã e registra cada contato; o gestor revisa a carteira e envia o relatório semanal à diretoria.
- *Como sei que funcionou?* Métrica de processo: % de clientes em alto risco contatados em até 48 h. Métrica de resultado (com histórico real): renovação e queda do score após o contato.
- *Governança?* Cada contato registra quem fez e quando. Permissões por papel: insights de produto e relatório da diretoria só para o gestor.
- *Isso prevê cancelamento?* Não. É um sinal de risco; os dados não têm histórico de cancelamento. Previsão é o próximo passo, com histórico real.

**Engenheiro de software (arquitetura, dados, integração)**
- *Arquitetura?* FastAPI + PostgreSQL + React, tudo em Docker Compose; contrato da API documentado em `docs/api-contract.md`; deploy automatizado via GitHub Actions.
- *Como integraria com o helpdesk/CRM real (ex.: Movidesk)?* Hoje a carga vem dos xlsx. Próximo passo: conector por API/webhook do helpdesk para atendimentos e telemetria de uso, recalculando o score em lote.
- *O k-means é confiável?* Ele agrupa as três notas de faceta; os nomes dos perfis vêm de regras sobre os centróides. O analista sempre vê as facetas e o motivo, não só o rótulo.
- *E o ML de churn?* Pipeline com dados sintéticos para mostrar o próximo passo; não substitui o score.

**Professor (engenharia, segurança, DevOps)**
- *Segredos?* `.env` fora do git; chave da IA e segredo do JWT por variável de ambiente (GitHub Secrets no deploy). Usuários de teste existem só para a demo.
- *Dados enviados para a IA (LGPD)?* Só o código do cliente e métricas; nunca o nome. Sem chave ou sem internet, nada sai do servidor.
- *Testes e observabilidade?* 18 testes automatizados (pytest) cobrindo carga, score, rotas, permissões, IA com fallback e relatórios. `/api/health` informa banco e carga sem derrubar a API.
- *Resiliência?* Timeout de 5 s sem retentativa na IA; qualquer falha cai para regras. Valor ausente é `null`, nunca 0.

## Limitações (falar no último minuto)

- Score é sinal de risco por regras, não previsão de cancelamento.
- 3 meses de uso e cada mês de um serviço: o engajamento é do cliente, não do serviço.
- Pesos das facetas (40/35/25) definidos pelo time; no produto real, configuráveis pelo gestor.
- Modelo de churn treinado com dados sintéticos, só como prova de conceito.
- Carga por planilha; integração com helpdesk e telemetria é o próximo passo.

## Próximos passos

1. Conector com helpdesk (Movidesk) e telemetria de uso, com recálculo diário.
2. Medir efeito: score antes e depois do contato, e renovação.
3. Pesos configuráveis pelo gestor.
4. Com histórico real de cancelamentos, treinar e validar um modelo supervisionado.
5. Testes no pipeline de CI antes do deploy.
