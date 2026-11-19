---
tags: [glossario, impostos]
type: conceito
---
# PIS e COFINS

Contribuições federais sobre receita. Dois regimes: **cumulativo** (0,65% e 3%, presumido) e **não cumulativo** (1,65% e 7,6%, lucro real). A função `compute_pis_cofins` escolhe pelo parâmetro de regime e trunca o resultado como qualquer imposto ([[Truncamento versus arredondamento]]).

Dúvida em aberto: com a [[Reforma tributária]] essas duas viram um tributo único; o módulo será revisto.
