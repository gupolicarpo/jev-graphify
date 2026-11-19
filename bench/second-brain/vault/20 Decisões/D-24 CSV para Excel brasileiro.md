---
tags: [decisao, relatorios, csv]
type: decisao
status: accepted
created: 2026-04-06
code: [reports/export_csv.py]
---
# D-24 CSV para Excel brasileiro

O financeiro abre tudo no Excel em português. Então `export_invoices_csv`:
- separa colunas com **ponto e vírgula**;
- troca ponto decimal por vírgula (`_fmt_decimal`);
- começa com BOM UTF-8 para o Excel reconhecer acentos.

Sem o BOM os nomes aparecem como "JosÃ©" — foi o [[I-2026-10 CSV com acentos quebrados]]. Quem consome o CSV por script deve ler com `utf-8-sig`.
