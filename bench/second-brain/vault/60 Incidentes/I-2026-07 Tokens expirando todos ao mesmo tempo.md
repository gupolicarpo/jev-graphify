---
tags: [incidente, auth, tokens]
type: incidente
status: closed
created: 2026-05-11
code: [auth/tokens.py]
---
# I-2026-07 Tokens expirando todos ao mesmo tempo

Segunda-feira 8h: todos os usuários deslogados de uma vez. O segredo dos tokens foi rotacionado no fim de semana e a rotação invalidou os tokens ativos (`verify_access_token` falhava por assinatura).

Sem plano de transição: o segredo antigo simplesmente deixou de existir. Ficou combinado preparar suporte a dois segredos durante a janela de rotação e avisar em canal de suporte. Procedimento atualizado: [[Rotacionar o segredo dos tokens]]. Conversa: [[2026-05-12 Daily estendida - incidente de tokens]].
