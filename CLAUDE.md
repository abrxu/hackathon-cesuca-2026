# Instruções do projeto

## Prioridade: aplicação rodando sem falhas

Funcionamento do protótipo é critério de avaliação (25 pts) e primeiro critério de desempate. Estabilidade vale mais que quantidade de features.

- Toda mudança deve deixar a aplicação executável de ponta a ponta (`docker compose up` ou o comando documentado no README).
- Após cada alteração relevante, subir a aplicação e validar o fluxo principal da demo antes de seguir.
- Preferir soluções simples e já testadas a abordagens novas ou arriscadas.
- Tratar erros de forma graciosa: dados ausentes/vazios (ex.: `tempo_resolucao_min` e `satisfacao_1_a_5` vazios em pendentes) não podem quebrar a tela.
- Dependências externas (APIs de IA, internet) devem ter fallback; a demo não pode depender de um serviço que pode falhar.
- Não deixar features pela metade no fluxo da demo: se não estiver pronto, remover ou esconder.
- Manter o README atualizado com instruções de execução, dependências e limitações.

## README sempre atualizado

A cada mudança que altere como rodar, configurar ou usar a aplicação (novas dependências, variáveis de ambiente, portas, comandos, telas/fluxos da demo, limitações ou problemas conhecidos de ambiente), atualizar o `README.md` no mesmo commit. As seções "Como executar", "Desenvolvimento" e "Limitações conhecidas" devem refletir o estado real do projeto.
