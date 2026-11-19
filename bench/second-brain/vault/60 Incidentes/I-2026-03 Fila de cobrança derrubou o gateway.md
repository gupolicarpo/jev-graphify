---
tags: [incidente, retry, gateway, postmortem]
type: incidente
status: closed
created: 2026-03-02
severity: sev1
code: [payments/legacy_retry.py, payments/card_gateway.py]
---
# I-2026-03 Fila de cobrança derrubou o gateway

**Impacto:** 47 minutos de cobrança em cartão indisponível no dia 2 de março, primeiro dia útil do mês (pico de recorrências).

**O que aconteceu**
O gateway ficou instável por 3 minutos. Todas as cobranças pendentes falharam juntas e foram reagendadas para 30 segundos depois — o mesmo instante para todas. Resultado: ondas de milhares de requisições a cada 30 s. O gateway nos limitou por taxa (HTTP 429) e o limite permaneceu até esvaziarmos a fila à mão.

**Causa raiz:** repetição em intervalo fixo ([[D-11 Repetir cobrança a cada 30 segundos]]), implementada em `fixed_interval_retry`, sem jitter nem teto de tentativas global.

**Ações**
- [x] Nova política: [[D-26 Backoff exponencial com jitter]]
- [x] Alerta de 429 no gateway
- [ ] Migrar o job legado de conciliação (acompanhar em [[Faturamento v2]])

Conversa posterior: [[2026-03-03 Conversa sobre retry do gateway]].
