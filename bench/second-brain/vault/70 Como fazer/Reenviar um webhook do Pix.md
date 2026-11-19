---
tags: [como-fazer, pix, webhook]
type: runbook
---
# Reenviar um webhook do Pix

1. No painel do banco, localize o e2eid e peça reenvio.
2. O corpo chega assinado; **não** reenvie você mesmo pelo curl com o corpo reformatado, a assinatura (`verify_signature`) vai falhar.
3. Se o evento já foi processado, o `IdempotencyStore` devolve a resposta guardada e não baixa de novo.
4. Para forçar o reprocessamento (raro), apague a chave da tabela `idempotency_keys` — somente com aprovação de quem está de plantão.
