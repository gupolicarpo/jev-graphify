---
tags: [leitura, livro, resiliencia]
type: leitura
---
# Release It — padrões de estabilidade

Notas gerais do livro de Nygard, nada específico do nosso sistema.

- **Timeouts** em toda chamada externa.
- **Circuit breaker**: parar de chamar um serviço que está falhando, para dar tempo de ele se recuperar.
- **Bulkheads**: isolar recursos para que uma falha não afunde tudo.
- **Retry** só faz sentido para falhas transitórias, com espera crescente e aleatoriedade; sem isso viramos parte do problema.

Para pensar: temos circuit breaker no gateway? Não. Anotar para o planejamento.
