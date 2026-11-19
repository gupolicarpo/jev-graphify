---
tags: [decisao, pro-rata, assinaturas]
aliases: [Pro rata comercial]
type: decisao
status: accepted
created: 2025-12-09
supersedes: "[[D-05 Pro rata pelos dias do mês de calendário]]"
code: [billing/proration.py]
---
# D-09 Mês comercial de 30 dias no pro rata

- Todo ciclo conta como **30 dias**, não importa o mês.
- Valor proporcional = preço mensal × dias restantes ÷ 30 (`prorate_subscription`).
- Dias restantes incluem o dia da adesão e são limitados a 30 (`days_remaining`).
- Troca de plano usa a mesma base: `prorate_upgrade` cobra só a diferença entre os planos.
- Arredondamento do resultado: o item gerado passa pela regra normal da fatura, ver [[D-19 Arredondamento por item]].

Quem adere no dia 12 de um ciclo que fecha no dia 30 paga 19/30 do preço. Exemplo e discussão em [[2026-05-26 Reunião sobre pro rata]]. Conceito: [[Mês comercial]].
