---
tags: [incidente, boleto, conciliacao, postmortem]
type: incidente
status: closed
created: 2026-03-05
severity: sev2
code: [payments/boleto.py]
---
# I-2026-04 Boleto pago em duplicidade

O banco reenviou o arquivo de retorno do dia 4 (por falha dele) e processamos de novo. 212 títulos foram baixados uma segunda vez; em 17 deles isso gerou crédito indevido para o cliente.

### Por que aconteceu
A conciliação não considerava "fatura já paga" como duplicada; só checava repetição *dentro* do mesmo arquivo.

### Correção
`reconcile_boleto` passou a tratar nosso número cuja fatura já está `paid` como duplicado, sem nova baixa, e a retornar a lista `duplicadas`.

### Para operar
Se o banco reenviar arquivos, siga [[Reprocessar o arquivo de retorno CNAB]]. A conversa de alinhamento foi em [[2026-03-10 Reunião de pagamentos duplicados]].
