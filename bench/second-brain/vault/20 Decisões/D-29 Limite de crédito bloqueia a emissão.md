---
tags: [decisao, credito, clientes]
type: decisao
status: accepted
created: 2026-06-24
code: [customers/credit.py]
---
# D-29 Limite de crédito bloqueia a emissão

Ao criar uma fatura, `credit_limit_check` soma o saldo em aberto do cliente (`open_balance`, apenas status `issued`) ao valor novo. Se passar do `credit_limit` do cadastro, levanta `CreditLimitExceeded` e a API responde 422. Limite zero significa "sem limite". Cliente `blocked` nunca emite.

Fatura paga libera crédito imediatamente. Discussão original em [[2026-06-23 Reunião sobre limite de crédito]]; definição em [[Limite de crédito]].
