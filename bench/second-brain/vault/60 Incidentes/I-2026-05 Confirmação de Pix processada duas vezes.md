---
tags: [incidente, pix, webhook]
type: incidente
status: closed
created: 2026-04-09
severity: sev3
code: [payments/pix.py, payments/idempotency.py]
---
# I-2026-05 Confirmação de Pix processada duas vezes

O banco reenviou o webhook de 31 pagamentos por timeout do nosso lado (respondíamos em 11 s; o limite deles é 10 s). Cada reenvio disparou e-mail de "pagamento recebido" duas vezes e, em 4 casos, uma segunda baixa em contas a receber do ERP.

Causa: `handle_pix_webhook` era chamado sem deduplicação. Hoje usa `IdempotencyStore` com chave `make_key("pix", txid, e2eid)`.

Medida extra: a resposta do webhook agora é imediata; o trabalho pesado vai para a fila. Para reenviar um webhook de propósito: [[Reenviar um webhook do Pix]].

Ver [[D-14 Chave de idempotência em cobranças e webhooks]].
