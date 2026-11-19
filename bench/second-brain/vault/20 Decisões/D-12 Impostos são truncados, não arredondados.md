---
tags: [decisao, impostos, arredondamento]
aliases: [Truncar impostos]
type: decisao
status: accepted
created: 2026-01-08
code: [taxes/rounding.py]
---
# D-12 Impostos são truncados, não arredondados

As prefeituras calculam o ISS truncando na segunda casa. Se arredondarmos meio para cima, nosso valor ultrapassa o da nota em até um centavo e a NFS-e é rejeitada por divergência de base.

**Regra:** qualquer imposto (ISS, PIS, COFINS) passa por `truncate_tax`, que usa `ROUND_DOWN`.

**Não confundir** com o arredondamento do valor da fatura, que é por item e meio para cima ([[D-19 Arredondamento por item]]). São dois módulos diferentes, ambos chamados `rounding.py`: o de `billing/` e o de `taxes/`. Já houve PR que importou o errado.

Comparação didática em [[Truncamento versus arredondamento]].
