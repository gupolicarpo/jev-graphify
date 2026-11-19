---
tags: [moc, incidentes]
type: moc
---
# MOC Incidentes e runbooks

| Incidente | Runbook / decisão relacionada |
|---|---|
| [[I-2026-01 Fatura duplicada na recorrência]] | [[Rodar a régua de cobrança fora de hora]] (job seguro de repetir) |
| [[I-2026-02 Total da fatura com um centavo a mais]] | [[D-19 Arredondamento por item]] |
| [[I-2026-03 Fila de cobrança derrubou o gateway]] | [[D-26 Backoff exponencial com jitter]] |
| [[I-2026-04 Boleto pago em duplicidade]] | [[Reprocessar o arquivo de retorno CNAB]] |
| [[I-2026-05 Confirmação de Pix processada duas vezes]] | [[Reenviar um webhook do Pix]] |
| [[I-2026-06 NFS-e rejeitada em Curitiba]] | [[Reemitir NFS-e rejeitada]] |
| [[I-2026-07 Tokens expirando todos ao mesmo tempo]] | [[Rotacionar o segredo dos tokens]] |
| [[I-2026-08 ERP fora do ar travou a sincronização]] | [[Rodar a sincronização com o ERP manualmente]] |
| [[I-2026-09 WhatsApp enviado sem opt-in]] | [[D-27 WhatsApp só com opt-in]] |
| [[I-2026-10 CSV com acentos quebrados]] | [[D-24 CSV para Excel brasileiro]] |

Outros runbooks: [[Inutilizar um número de fatura]], [[Gerar o relatório de inadimplência]], [[Importar clientes de planilha]], [[Preparar um release]].
