---
tags: [incidente, arredondamento, faturas]
type: incidente
status: closed
created: 2026-01-29
severity: sev3
---
# I-2026-02 Total da fatura com um centavo a mais

Um cliente grande (contrato de 14 itens) abriu chamado: "a soma dos itens do PDF dá R$ 8.412,33 e o total diz R$ 8.412,34". Não era bug de cálculo, era a regra vigente da época ([[D-07 Arredondar apenas o total da fatura]]): arredondava só no fim.

Impacto: 9 chamados no mês, nenhum financeiro. Mas o ERP do cliente rejeitava a nota por divergência de soma.

Ação: reunião [[2026-02-03 Reunião de arredondamento]] e a nova regra [[D-19 Arredondamento por item]]. Faturas antigas **não** foram recalculadas.
