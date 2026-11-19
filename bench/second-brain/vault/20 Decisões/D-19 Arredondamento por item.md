---
tags: [decisao, arredondamento, faturas]
aliases: [Arredondar cada item]
type: decisao
status: accepted
created: 2026-02-05
supersedes: "[[D-07 Arredondar apenas o total da fatura]]"
code: [billing/rounding.py, billing/invoice.py]
---
# D-19 Arredondamento por item

**Regra:** cada item da fatura é arredondado para centavos, meio para cima, **antes** de somar (`round_item_amount`). O total é a soma dos itens já arredondados (`round_invoice_total`). O que o cliente vê impresso sempre fecha com a soma.

Detalhes
1. O desconto percentual entra antes do arredondamento: `InvoiceItem.net_amount` aplica o desconto ao bruto e só então arredonda.
2. Quando um sistema externo exige total pré-definido, `distribute_residual_cent` joga a sobra de centavos no maior item.
3. Parcelamento: `installment_split` põe o resto na primeira parcela.

Impostos **não** seguem esta regra; ver [[D-12 Impostos são truncados, não arredondados]].

Origem: [[I-2026-02 Total da fatura com um centavo a mais]] e a conversa de [[2026-02-03 Reunião de arredondamento]]. Termo: [[Resíduo de centavos]].
