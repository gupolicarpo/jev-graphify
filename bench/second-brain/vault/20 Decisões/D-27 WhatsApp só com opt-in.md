---
tags: [decisao, cobranca, whatsapp, lgpd]
type: decisao
status: accepted
created: 2026-06-04
code: [notifications/whatsapp.py]
---
# D-27 WhatsApp só com opt-in

Mensagem de cobrança por WhatsApp só sai para cliente que **autorizou** o canal. Na prática: telefone cadastrado = consentimento registrado no onboarding. `send_whatsapp_reminder` levanta `OptInRequired` quando não há telefone, e o ciclo de cobrança apenas pula o cliente.

Nasceu do [[I-2026-09 WhatsApp enviado sem opt-in]]. A régua em si está em [[D-28 Régua de cobrança em três estágios]]; o conceito jurídico em [[Opt-in]].
