---
tags: [incidente, relatorios, csv]
type: incidente
status: closed
created: 2026-06-26
code: [reports/export_csv.py]
---
# I-2026-10 CSV com acentos quebrados

O financeiro reclamou que "Conceição" apareceu como "ConceiÃ§Ã£o" no relatório exportado e que os valores vinham com ponto (o Excel tratou como data!). O arquivo era UTF-8 sem BOM, separado por vírgula.

Mudança: ver [[D-24 CSV para Excel brasileiro]]. Quem abrir direto no Excel agora vê tudo certo; quem importa por script deve ler como `utf-8-sig`.
