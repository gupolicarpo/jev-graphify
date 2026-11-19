---
tags: [decisao, retry, pagamentos]
type: decisao
status: superseded
superseded_by: "[[D-26 Backoff exponencial com jitter]]"
created: 2025-12-16
---
# D-11 Repetir cobrança a cada 30 segundos

Regra antiga para falhas do gateway de cartão: até **3 tentativas**, espaçadas por **30 segundos fixos**. Implementada em `fixed_interval_retry`, hoje marcada como deprecada em `payments/legacy_retry.py`.

Funcionou enquanto o volume era pequeno. Quando uma queda do gateway coincidiu com a virada de mês, centenas de cobranças tentaram de novo no mesmo instante, repetidamente (ver [[I-2026-03 Fila de cobrança derrubou o gateway]]).

**Substituída por** [[D-26 Backoff exponencial com jitter]]. O job de conciliação antigo ainda usa a função legada; está na lista do [[Faturamento v2]] para migrar.
