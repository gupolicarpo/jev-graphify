---
tags: [glossario, impostos, arredondamento]
type: conceito
---
# Truncamento versus arredondamento

| | Truncar | Arredondar (meio para cima) |
|---|---|---|
| 10,129 | 10,12 | 10,13 |
| 10,125 | 10,12 | 10,13 |
| 10,121 | 10,12 | 10,12 |

Impostos municipais são **truncados**; valores comerciais da fatura são **arredondados**. Um dev recém-chegado quase sempre usa o mesmo método para os dois, e aí a nota fiscal diverge do boleto em um centavo.

- Impostos: [[D-12 Impostos são truncados, não arredondados]] (`truncate_tax`).
- Fatura: [[D-19 Arredondamento por item]] (`round_item_amount`).
