---
tags: [glossario, inadimplencia, relatorios]
aliases: [aging, faixas de inadimplência]
type: conceito
---
# Faixas de atraso (aging)

Agrupamento do saldo vencido por tempo de atraso: **1–30**, **31–60**, **61–90** e **90+** dias. O financeiro olha a faixa para decidir ação: até 30 é régua automática, de 31 em diante entra cobrança humana, 90+ vai para provisão de perdas.

Implementação: `bucket_for` e `build_aging_report` (`reports/aging.py`). Como gerar: [[Gerar o relatório de inadimplência]].
