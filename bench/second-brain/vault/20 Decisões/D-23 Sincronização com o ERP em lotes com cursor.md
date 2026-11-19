---
tags: [decisao, erp, sincronizacao]
type: decisao
status: accepted
created: 2026-03-30
code: [integrations/erp/sync.py, integrations/erp/client.py]
---
# D-23 Sincronização com o ERP em lotes com cursor

Em vez de enviar cada fatura no momento da emissão (acoplamento forte: ERP fora = emissão travada), um job envia em **lotes de 200** (`ERP_BATCH`, `erp_batch_size`) as faturas com id maior que o cursor guardado em `sync_cursors`.

- `sync_invoices_to_erp` percorre os ids em ordem, mapeia com `map_invoice_to_erp` e posta com `ErpClient.post_receivable`.
- Resposta 409 do ERP (já existe) conta como sucesso: reenviar é seguro.
- O cursor só avança até a última fatura enviada com sucesso.

Entenda o cursor em [[Cursor de sincronização]]. O comportamento diante de erro foi revisado depois: [[D-30 Falha no ERP interrompe o lote]].
