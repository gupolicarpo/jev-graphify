---
tags: [incidente, erp]
type: incidente
status: closed
created: 2026-05-30
code: [integrations/erp/sync.py, integrations/erp/client.py]
---
# I-2026-08 ERP fora do ar travou a sincronização

O ERP Alfa ficou 6 horas indisponível. Com a regra da época ([[D-16 Seguir o lote quando o ERP rejeita uma fatura]]), `sync_invoices_to_erp` seguia em frente e avançava o cursor sobre falhas; ao voltar, 214 faturas nunca foram reenviadas.

Reenvio manual feito com consulta por número. A decisão [[D-30 Falha no ERP interrompe o lote]] foi tomada em seguida.
