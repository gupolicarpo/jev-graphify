---
tags: [glossario, pagamentos, resiliencia]
aliases: [idempotente]
type: conceito
---
# Idempotência

Uma operação é idempotente quando repetir o pedido produz o mesmo efeito que fazê-lo uma vez. Cobrar um cartão **não** é idempotente por natureza; tornamos idempotente enviando uma chave única que o gateway usa para reconhecer repetição.

Regra de bolso da equipe: se a operação toca dinheiro e pode ser repetida por rede, fila ou humano, ela precisa de chave. Decisão formal: [[D-14 Chave de idempotência em cobranças e webhooks]].
