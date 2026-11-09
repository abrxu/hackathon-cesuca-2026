# Retenção de Clientes

Linguagem usada para identificar clientes de uma empresa de software B2B que mostram sinais de risco de cancelamento e organizar a ação de quem cuida deles.

## Pessoas

**Analista de CS (L1)**:
Pessoa de Sucesso do Cliente que decide, todo dia, com quais clientes falar e como abordar.
_Avoid_: atendente, operador

**Gestor (L2)**:
Gerente operacional que acompanha a carteira e leva a visão consolidada para a diretoria.
_Avoid_: admin, supervisor

## Carteira

**Cliente**:
Empresa que contrata um ou mais serviços da empresa de software.
_Avoid_: conta, usuário, empresa

**Serviço**:
Produto contratado pelo cliente: Sistema Alfa, Sistema Beta, Portal Web ou Aplicativo Mobile.
_Avoid_: módulo, sistema (genérico)

**Atendimento**:
Solicitação aberta por um cliente sobre um serviço, com assunto, canal, prioridade e status.
_Avoid_: ticket, chamado (na interface use "chamado" só como sinônimo visual, nunca no código)

**Uso**:
Volume mensal de acessos e operações de um cliente em um serviço.
_Avoid_: atividade, consumo

## Risco

**Churn**:
Cancelamento do cliente. Não existe nos dados; é o desfecho que o produto tenta evitar.
_Avoid_: perda, evasão

**Sinal de risco**:
Indício observável nos dados de que o cliente pode estar caminhando para o churn. Nunca é uma previsão.
_Avoid_: previsão, probabilidade de churn

**Faceta de risco**:
Uma dimensão independente do sinal de risco, como queda de uso ou atrito no atendimento.
_Avoid_: variável, feature

**Score de risco**:
Número de 0 a 100 que combina as facetas de risco de um cliente e ordena a prioridade de contato.
_Avoid_: nota, health score (usar só se for a escala invertida)

**Impacto**:
Peso do cliente para o negócio, dado pelo porte. Ordena a prioridade de contato, mas não aumenta o score de risco.
_Avoid_: valor, relevância

**Perfil de risco**:
Padrão de comportamento que explica o tipo de risco do cliente: Silencioso, Frustrado, Travado ou Saudável.
_Avoid_: cluster, segmento, categoria

**Insight de produto**:
Concentração de problemas em um serviço, observada na carteira inteira e destinada ao Gestor. Não entra no score de nenhum cliente.
_Avoid_: alerta de produto, bug

**Sinal de contexto**:
Fato sobre o cliente que muda a forma de agir, mas não o risco, como ser cliente recente ou ter um assunto recorrente.
_Avoid_: flag, onboarding (como rótulo automático)

**Relatório do analista**:
Arquivo que o Analista de CS envia ao Gestor com a carteira, os riscos e os contatos feitos.
_Avoid_: export, planilha

**Relatório do gestor**:
Arquivo consolidado e resumido que o Gestor envia à diretoria.
_Avoid_: relatório executivo, dashboard da diretoria

**Ação sugerida**:
Próximo passo recomendado ao Analista de CS para um cliente específico, com o roteiro de abordagem.
_Avoid_: recomendação, insight
