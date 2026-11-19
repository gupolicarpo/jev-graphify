---
tags: [como-fazer, erp, runbook]
type: runbook
created: 2026-04-01
code: [integrations/erp/sync.py]
---
# Rodar a sincronização com o ERP manualmente

Quando o alerta de falhas disparar:

1. Veja o número da fatura em `falhas` no retorno de `sync_invoices_to_erp`.
2. Consulte o ERP por esse número. Se existir, é só reenviar (409 conta como sucesso).
3. Se o ERP recusa por dado cadastral (documento, vencimento), corrija a fatura e rode de novo.
4. Confirme que o cursor avançou na tabela `sync_cursors`.

Não edite o cursor à mão para "pular" a fatura problemática — o lote vai esconder o problema (ver [[D-30 Falha no ERP interrompe o lote]] e [[Cursor de sincronização]]).
