---
tags: [decisao, boleto, vencimento]
type: decisao
status: accepted
created: 2026-02-09
code: [payments/boleto.py]
---
# D-18 Boleto nunca vence em dia não útil

Se a data de vencimento pedida cai em sábado, domingo ou feriado nacional, `boleto_due_date` empurra para o próximo dia útil. A fatura mantém o vencimento original; só o boleto muda. Assim o banco não cobra multa de quem paga no primeiro dia útil.

Limitação conhecida: só feriados **nacionais** (constante `FERIADOS_NACIONAIS`); feriado municipal ainda pode gerar boleto com vencimento num dia em que o banco local fecha. Está no backlog.
