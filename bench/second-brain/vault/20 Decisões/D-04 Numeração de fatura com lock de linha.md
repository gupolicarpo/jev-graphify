---
tags: [decisao, numeracao, banco]
aliases: [Sequência sem buracos]
type: decisao
status: accepted
created: 2025-10-28
code:
  - billing/numbering.py
---
# D-04 Numeração de fatura com lock de linha

A numeração fiscal não pode ter buracos nem repetição. Cogitamos usar `SEQUENCE` do Postgres, mas ela pula números em rollback, o que obrigaria a inutilizar números toda vez que uma emissão falha.

**Decisão:** tabela `invoice_sequences` com uma linha por série; `next_invoice_number` abre transação, faz `SELECT ... FOR UPDATE`, incrementa e só então devolve o número. Duas emissões simultâneas na mesma série ficam serializadas (custo aceitável: emitimos poucas centenas por minuto no pico).

Se uma emissão falhar depois de pegar o número, `release_unused_number` devolve o número quando ele ainda é o último; caso contrário registra em `invoice_voids` para a inutilização formal. Veja o passo a passo em [[Inutilizar um número de fatura]] e o conceito de [[Série de fatura]].
