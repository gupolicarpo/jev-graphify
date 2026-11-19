---
tags: [glossario, nota-fiscal]
aliases: [Recibo Provisório de Serviços]
type: conceito
---
# RPS

Recibo Provisório de Serviços. É o documento que enviamos à prefeitura *antes* de existir a NFS-e; a prefeitura devolve a nota definitiva trocando o RPS por ela. Carrega número, série e data. No payload de `build_nfse_payload` o bloco `rps` usa o número e a série da fatura (`invoice.number`, `invoice.series`).

Se o envio do RPS der timeout, **não reenvie às cegas**: a prefeitura pode ter recebido. Consulte antes (ver [[Reemitir NFS-e rejeitada]]).
