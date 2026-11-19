---
tags: [reuniao, retro, incidente]
type: reuniao
date: 2026-02-10
---
# Retro: fatura duplicada

O que deu certo: suporte avisou cedo; fatura extra foi cancelada em lote.
O que deu errado: sem alerta de volume anormal; sem teste de reexecução.
Ações:
1. Alerta quando o job gera mais de 110% do esperado (Beatriz)
2. Teste de job reexecutado (Juliana)
3. Revisar todos os jobs com a pergunta "e se rodar duas vezes?" (Diego)

Postmortem: [[I-2026-01 Fatura duplicada na recorrência]].
