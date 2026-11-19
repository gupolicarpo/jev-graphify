---
tags: [reuniao, seguranca]
type: reuniao
date: 2026-04-14
participantes: [Otávio, Marina, Lívia]
---
# Revisão de segurança

Itens do Otávio:
1. Segredos em variável de ambiente, nunca em repositório — ok.
2. Tokens de acesso: precisamos de rotação sem derrubar sessões (pendente).
3. Webhooks: assinatura obrigatória, ok desde a [[D-21 Webhook do Pix exige assinatura HMAC]].
4. Logs: nunca imprimir cabeçalho de autorização.

Ação: Lívia revisa logs de `api/routes.py`; Otávio escreve o plano do [[Endurecimento de autenticação]].
