---
private: true
tags: [incidente, seguranca, rascunho]
type: incidente
status: draft
created: 2026-07-02
---
# I-2026-11 Chave do ERP exposta em log (rascunho)

MARCADOR-PRIVADO-7731

Rascunho de postmortem, ainda sem revisão do Otávio. O token de API do ERP apareceu em texto puro num log de depuração do `ErpClient` em `integrations/erp/client.py`. Precisa rotacionar o token do ERP e também o segredo dos tokens de acesso. Não divulgar para o cliente até a conclusão da análise com o jurídico. Passos de rotação: [[Rotacionar o segredo dos tokens]].
