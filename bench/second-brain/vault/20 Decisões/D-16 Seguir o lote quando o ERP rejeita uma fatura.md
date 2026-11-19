---
tags: [decisao, erp, sincronizacao]
type: decisao
status: superseded
superseded_by: "[[D-30 Falha no ERP interrompe o lote]]"
created: 2026-01-26
---
# D-16 Seguir o lote quando o ERP rejeita uma fatura

Regra original: se o ERP respondesse erro para uma fatura, registrávamos a falha em log e **continuávamos** com as próximas do lote, avançando o cursor.

Descobrimos no primeiro mês que isso deixava faturas para trás: o cursor passava por elas e ninguém reenviava. O financeiro achou 41 títulos faltando no ERP. Substituída por [[D-30 Falha no ERP interrompe o lote]].
