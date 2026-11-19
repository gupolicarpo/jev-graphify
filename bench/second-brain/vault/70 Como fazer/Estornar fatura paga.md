---
tags: [como-fazer, estorno, pagamentos]
type: howto
code: [payments/refunds.py]
---
# Estornar fatura paga

Use `issue_refund(conn, invoice_id, valor, motivo)`.

Regras que a função aplica: fatura precisa estar paga, valor positivo e soma de estornos não pode passar do total (`RefundNotAllowed`). Devolve o id do estorno.

Lembre que o estorno não cancela a NFS-e; fale com o financeiro. Ver [[Estorno]].
