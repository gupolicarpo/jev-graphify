---
tags: [glossario, pix]
aliases: [txid, e2eid]
type: conceito
---
# Pix: txid e e2eid

- **txid**: identificador da *cobrança*, escolhido por nós. Em `create_pix_charge` é um prefixo mais o número da fatura sem hífen.
- **e2eid**: identificador *ponta a ponta* da liquidação, gerado pelo Banco Central; cada pagamento tem o seu.

Um mesmo txid pode (raramente) receber dois pagamentos; por isso a chave de idempotência do webhook combina os dois (`make_key("pix", txid, e2eid)`), ver [[D-14 Chave de idempotência em cobranças e webhooks]].
