---
tags: [decisao, pix, seguranca, webhook]
type: decisao
status: accepted
created: 2026-02-16
code: [payments/pix.py]
---
# D-21 Webhook do Pix exige assinatura HMAC

O endpoint de webhook recebe o corpo **cru** (bytes) e o cabeçalho `X-Signature`. `verify_signature` calcula HMAC-SHA256 com o segredo do ambiente e compara em tempo constante (`hmac.compare_digest`). Assinatura inválida levanta `InvalidSignature` e a API responde 400, sem processar nada.

Importante: validar antes de fazer `json.loads` — qualquer parse prévio que reordene o JSON invalida a assinatura. Só depois da validação entra a deduplicação de [[D-14 Chave de idempotência em cobranças e webhooks]].

Segredo: variável `PIX_WEBHOOK_SECRET`, lida em `load_settings`.
