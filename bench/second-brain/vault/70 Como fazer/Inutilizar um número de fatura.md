---
tags: [como-fazer, numeracao, nota-fiscal]
type: howto
code: [billing/numbering.py]
---
# Inutilizar um número de fatura

Se o número foi consumido e a fatura não existe, não apague da tabela. Use `release_unused_number`: ele devolve o número se for o último da série, ou registra a inutilização em `invoice_voids`. O financeiro precisa de uma justificativa de ao menos 15 caracteres para a declaração mensal. Conceito: [[Série de fatura]].
