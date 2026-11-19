---
tags: [decisao, retry, pagamentos, resiliencia]
aliases: [Nova política de retry, ADR retry]
type: decisao
status: accepted
created: 2026-03-12
supersedes: "[[D-11 Repetir cobrança a cada 30 segundos]]"
code: [payments/retry.py, payments/card_gateway.py, config.py]
---
# D-26 Backoff exponencial com jitter

## Regra vigente
Falhas **transitórias** (timeout, 5xx) são repetidas com espera crescente: 2 s, 4 s, 8 s… até o teto de 300 s, com **±25% de jitter**, no máximo **6 tentativas**. Implementação: `RetryPolicy` (`delay_for`) e `with_retry`.

Falhas **permanentes** (`PermanentFailure`, ex.: cartão recusado) não são repetidas.

## Por quê
O intervalo fixo da [[D-11 Repetir cobrança a cada 30 segundos]] sincronizava todas as filas e martelava o gateway ([[I-2026-03 Fila de cobrança derrubou o gateway]]). O jitter espalha as tentativas.

## Parâmetros
`max_retry_attempts` e `retry_base_delay_seconds` em `Settings`. O `ErpClient` usa uma política mais curta (4 tentativas). Conceitos: [[Backoff exponencial]], [[Jitter]], [[Falha transitória e permanente]].
