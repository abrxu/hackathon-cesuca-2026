# Instruções do projeto

Radar de Clientes: produto interno de retenção para o time de Customer Success de uma empresa de software B2B. Vocabulário em [GLOSSARY.md](GLOSSARY.md).

## Prioridade: aplicação rodando sem falhas

Funcionamento do protótipo é critério de avaliação (25 pts) e primeiro critério de desempate. Estabilidade vale mais que quantidade de features.

- Toda mudança deve deixar a aplicação executável de ponta a ponta (`docker compose up` ou o comando documentado no README).
- Após cada alteração relevante, subir a aplicação e validar o fluxo principal da demo antes de seguir.
- Preferir soluções simples e já testadas a abordagens novas ou arriscadas.
- Tratar erros de forma graciosa: dados ausentes/vazios (ex.: `tempo_resolucao_min` e `satisfacao_1_a_5` vazios em pendentes) não podem quebrar a tela.
- Dependências externas (APIs de IA, internet) devem ter fallback; a demo não pode depender de um serviço que pode falhar.
- Não deixar features pela metade no fluxo da demo: se não estiver pronto, remover ou esconder.
- A interface é o produto final demonstrado no pitch: não exibir legendas, avisos ou ressalvas sobre limitações (ex.: "a IA pode errar", "isto não é uma previsão", "dados fictícios"). Limitações ficam só no README e na fala do pitch.
- Manter o README atualizado com instruções de execução, dependências e limitações.

## README sempre atualizado

A cada mudança que altere como rodar, configurar ou usar a aplicação (novas dependências, variáveis de ambiente, portas, comandos, telas/fluxos da demo, limitações ou problemas conhecidos de ambiente), atualizar o `README.md` no mesmo commit. As seções "Como executar", "Desenvolvimento" e "Limitações conhecidas" devem refletir o estado real do projeto.

## Divisão do trabalho

- Esta frente cuida de **backend (FastAPI), banco (PostgreSQL), IA/agente e ML**. O frontend (React/Vite) é de outro time.
- O contrato entre as frentes é [docs/api-contract.md](docs/api-contract.md). Qualquer mudança de rota, campo ou enum atualiza esse arquivo no mesmo commit.
- Não editar `frontend/` sem pedido explícito.

## Regras de domínio

- O score de risco é um **sinal**, calculado por regras explicáveis: facetas Engajamento, Atrito e Satisfação. A soma das contribuições das facetas é igual ao score.
- Engajamento compara o **uso total do cliente por mês** (jul → set). Cada mês do arquivo de uso pode ser de um serviço diferente; não comparar serviço a serviço. Operações pesam mais que acessos (≈ 60/40).
- Impacto (porte) só desempata a prioridade de contato; não altera o score.
- Perfil de risco (Silencioso, Frustrado, Travado, Saudável) vem de clustering (k-means) sobre as facetas, com fallback por regras.
- Tempo de casa e assuntos recorrentes são **sinais de contexto** que o raciocínio da ação sugerida considera junto com os demais; cliente recente com problema não vira "onboarding" automaticamente.
- Insight de produto (assunto × serviço) é só para o gestor e não entra no score de nenhum cliente.
- A IA explica, escreve e organiza pela prioridade já calculada; ela não calcula o score. O agente usa apenas funções fixas do backend, nunca SQL gerado.
- Não existe rótulo de churn nos dados oficiais. Qualquer modelo supervisionado usa histórico simulado, separado e identificado como tal, e não substitui o score na demo.
- Dois papéis com login: `analista` (CS, reporta ao gestor) e `gestor` (reporta à diretoria). A diretoria não acessa o sistema; recebe os arquivos do gestor.
- `data_cadastro` vem do Excel como número serial (dias desde 1899-12-30); converter na carga.
