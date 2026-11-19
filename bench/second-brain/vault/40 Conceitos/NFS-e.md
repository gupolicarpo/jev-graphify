---
tags: [glossario, nota-fiscal, impostos]
aliases: [Nota fiscal de serviço, nota de serviço]
type: conceito
---
# NFS-e

Nota Fiscal de Serviço eletrônica. Cada prefeitura tem (ou tinha) seu próprio provedor e layout; por isso a integração monta o payload em `build_nfse_payload` e envia com `submit_nfse`. O retorno vira um `NfseStatus`: pendente, autorizada, rejeitada ou cancelada.

Notas **de produto** (NF-e, ICMS) não são escopo do faturamento; só serviços.

A migração para o padrão nacional está em [[Nota fiscal nacional]]. Primeiro passo de qualquer envio: o [[RPS]].
