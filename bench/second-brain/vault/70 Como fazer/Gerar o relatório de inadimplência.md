---
tags: [como-fazer, relatorios]
type: howto
code: [reports/aging.py, reports/export_csv.py]
---
# Gerar o relatório de inadimplência

`build_aging_report(conn, hoje)` devolve o saldo por faixa e por cliente. Para planilha, as faturas vão por `export_invoices_csv` (arquivo já com BOM e ponto e vírgula, [[D-24 CSV para Excel brasileiro]]). Faixas explicadas em [[Faixas de atraso (aging)]]. O financeiro costuma pedir no dia 5 de cada mês.
