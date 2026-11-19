---
tags: [como-fazer, seguranca, runbook]
type: runbook
created: 2026-05-14
code: [auth/tokens.py, config.py]
---
# Rotacionar o segredo dos tokens

O segredo vem de `TOKEN_SECRET` (`Settings.token_secret`). Trocar derruba **todas** as sessões, porque `verify_access_token` recalcula a assinatura com o segredo atual.

## Janela segura
1. Avise o suporte com 24 h de antecedência.
2. Faça a troca fora do horário comercial.
3. Suba a versão nova; usuários terão de entrar de novo. O `ttl` padrão é 1 h, então o impacto dura no máximo isso para quem estava logado.
4. Registre a data da rotação no cofre de segredos.

Por que isso virou procedimento: [[I-2026-07 Tokens expirando todos ao mesmo tempo]]. Reunião de segurança: [[2026-04-14 Revisão de segurança]].
