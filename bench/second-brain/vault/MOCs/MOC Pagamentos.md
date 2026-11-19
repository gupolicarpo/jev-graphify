---
tags: [moc, pagamentos]
type: moc
---
# MOC Pagamentos

Conceitos: [[Boleto]], [[Nosso número]], [[Arquivo de retorno CNAB]], [[Conciliação bancária]], [[Pix txid e e2eid]], [[Idempotência]], [[Backoff exponencial]], [[Jitter]], [[Falha transitória e permanente]], [[Estorno]].

Decisões: [[D-14 Chave de idempotência em cobranças e webhooks]], [[D-15 Conciliação de boleto pelo retorno CNAB diário]], [[D-20 Conciliação tolera até cinco centavos]], [[D-21 Webhook do Pix exige assinatura HMAC]], [[D-26 Backoff exponencial com jitter]].

Incidentes: [[I-2026-03 Fila de cobrança derrubou o gateway]], [[I-2026-04 Boleto pago em duplicidade]], [[I-2026-05 Confirmação de Pix processada duas vezes]].

Operação: [[Reprocessar o arquivo de retorno CNAB]], [[Reenviar um webhook do Pix]], [[Estornar fatura paga]].
