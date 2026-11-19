---
tags: [incidente, whatsapp, lgpd]
type: incidente
status: closed
created: 2026-06-04
code: [notifications/whatsapp.py, jobs/dunning.py]
---
Lembrete de cobrança enviado a 19 clientes que nunca autorizaram o canal; 3 reclamaram à operadora da API e a conta quase foi suspensa.

Causa: `run_dunning_cycle` usava o telefone do contato de cobrança, que podia ser de outra pessoa. Ação imediata: bloquear o envio sem cadastro de opt-in e pedir desculpas por e-mail. Regra definitiva: [[D-27 WhatsApp só com opt-in]].
