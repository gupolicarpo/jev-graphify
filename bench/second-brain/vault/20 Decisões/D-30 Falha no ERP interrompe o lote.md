---
tags: [decisao, erp, sincronizacao, resiliencia]
type: decisao
status: accepted
created: 2026-07-08
supersedes: "[[D-16 Seguir o lote quando o ERP rejeita uma fatura]]"
code: [integrations/erp/sync.py]
---
# D-30 Falha no ERP interrompe o lote

Se o ERP rejeitar uma fatura, `sync_invoices_to_erp` **para** o lote, registra o número em `falhas` e salva o cursor na última fatura enviada com sucesso. A próxima rodada recomeça exatamente da fatura problemática. Nada fica para trás.

Efeito colateral aceito: uma fatura ruim bloqueia as seguintes até alguém corrigir. Para isso há alerta (falhas > 0 por mais de 1 hora) e o procedimento em [[Rodar a sincronização com o ERP manualmente]].

Discussão em [[2026-07-07 Reunião sobre falhas do ERP]]; incidente motivador: [[I-2026-08 ERP fora do ar travou a sincronização]].
