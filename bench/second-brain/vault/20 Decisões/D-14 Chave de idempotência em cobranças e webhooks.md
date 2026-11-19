---
tags: [decisao, idempotencia, pagamentos]
aliases: [ADR idempotência]
type: decisao
status: accepted
created: 2026-01-12
code: [payments/idempotency.py, payments/card_gateway.py]
---
# D-14 Chave de idempotência em cobranças e webhooks

**Contexto:** gateways e bancos reenviam eventos. Duas cobranças iguais viram duas cobranças.

**Decisão**
1. Toda chamada de cobrança leva o cabeçalho `Idempotency-Key` (`CardGateway.charge_card` exige o parâmetro).
2. Todo webhook recebido gera uma chave com `make_key` e passa por `IdempotencyStore.check_or_store`; repetido devolve a resposta guardada (`DuplicateRequest`).
3. Chaves expiram em 48 horas (`IdempotencyStore.TTL`); `purge_expired` limpa.

**Alternativas descartadas:** deduplicar só por `txid` (colide quando o banco reutiliza) e confiar no gateway (nem todos oferecem).

Veja [[Idempotência]] e o efeito prático em [[I-2026-05 Confirmação de Pix processada duas vezes]].
