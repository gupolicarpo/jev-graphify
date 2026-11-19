---
tags: [moc, decisoes]
type: moc
---
# MOC Decisões

## Dinheiro e arredondamento
- [[D-02 Dinheiro sempre em Decimal]]
- [[D-07 Arredondar apenas o total da fatura]] (substituída)
- [[D-19 Arredondamento por item]]
- [[D-12 Impostos são truncados, não arredondados]]

## Assinaturas
- [[D-05 Pro rata pelos dias do mês de calendário]] (substituída)
- [[D-09 Mês comercial de 30 dias no pro rata]]
- [[D-04 Numeração de fatura com lock de linha]]

## Pagamentos e resiliência
- [[D-11 Repetir cobrança a cada 30 segundos]] (substituída)
- [[D-26 Backoff exponencial com jitter]]
- [[D-14 Chave de idempotência em cobranças e webhooks]]
- [[D-21 Webhook do Pix exige assinatura HMAC]]
- [[D-15 Conciliação de boleto pelo retorno CNAB diário]]
- [[D-13 Conciliação aceita diferença de um centavo]] (substituída)
- [[D-20 Conciliação tolera até cinco centavos]]
- [[D-18 Boleto nunca vence em dia não útil]]

## Impostos
- [[D-17 Retenção de ISS apenas para tomador PJ]]

## Integrações
- [[D-23 Sincronização com o ERP em lotes com cursor]]
- [[D-16 Seguir o lote quando o ERP rejeita uma fatura]] (substituída)
- [[D-30 Falha no ERP interrompe o lote]]

## Cobrança e clientes
- [[D-08 Cobrança em dois avisos]] (substituída)
- [[D-28 Régua de cobrança em três estágios]]
- [[D-27 WhatsApp só com opt-in]]
- [[D-29 Limite de crédito bloqueia a emissão]]
- [[D-24 CSV para Excel brasileiro]]
