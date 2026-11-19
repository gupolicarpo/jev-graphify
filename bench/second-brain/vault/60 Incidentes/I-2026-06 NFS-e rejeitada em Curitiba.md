---
tags: [incidente, nfse, curitiba]
type: incidente
status: closed
created: 2026-04-16
---
# I-2026-06 NFS-e rejeitada em Curitiba

Durante 5 dias, toda NFS-e para tomadores de Curitiba voltou com "divergência na base de cálculo". A prefeitura trocou o validador e passou a exigir o ISS **truncado**; nós já truncávamos, mas o valor do item era enviado com 3 casas em `build_nfse_payload`.

Correção: enviar `str(i.net_amount)` (já com 2 casas). Reemissão das notas rejeitadas com o procedimento de [[Reemitir NFS-e rejeitada]]; 63 notas reemitidas.

Retro: [[2026-04-21 Retro da NFS-e Curitiba]].
