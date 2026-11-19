---
tags: [incidente, postmortem, recorrencia]
type: incidente
status: closed
created: 2026-01-22
severity: sev2
code: [billing/recurring.py]
---
# I-2026-01 Fatura duplicada na recorrência

## Resumo
Em 22/01, 138 clientes receberam duas faturas da assinatura do mês. O job de recorrência rodou duas vezes (o agendador foi reiniciado durante a execução e o job retomou do início).

## Linha do tempo
- 03:00 job começa
- 03:12 deploy reinicia o worker; job reinicia
- 08:40 suporte recebe o primeiro chamado
- 09:30 causa encontrada, faturas extras canceladas

## Causa raiz
`generate_recurring_invoices` não verificava se a assinatura já tinha fatura no mês.

## Correção
Foi criado `_already_billed`, que consulta fatura do mesmo mês para a assinatura antes de gerar. Teste de regressão cobre a reexecução do job.

## O que aprendemos
Jobs periódicos precisam ser idempotentes por construção ([[Idempotência]]). Retro em [[2026-02-10 Retro do incidente da fatura duplicada]].
