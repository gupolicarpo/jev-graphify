---
tags: [decisao, dinheiro, fundamentos]
aliases: [ADR dinheiro, Decimal no lugar de float]
type: decisao
status: accepted
created: 2025-10-14
code: [billing/invoice.py, billing/rounding.py]
---
# D-02 Dinheiro sempre em Decimal

## Contexto
No protótipo, o primeiro cálculo de fatura usava `float` e a soma de 0,1 + 0,2 apareceu num PDF como R$ 0,30000000000000004. Ninguém quer explicar isso a um cliente.

## Decisão
Todo valor monetário, quantidade fracionária e alíquota é `Decimal` construído a partir de **string**, nunca de float. Serialização em JSON também sai como string (`"1250.00"`).

## Consequências
- Testes comparam com `Decimal("...")`.
- Banco usa `numeric(14,2)` para valores e `numeric(8,6)` para alíquotas.
- A regra de como e quando arredondar fica em [[D-19 Arredondamento por item]]; aqui só definimos o tipo.

#decisao #dinheiro
