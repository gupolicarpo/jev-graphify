---
tags: [glossario, resiliencia]
type: conceito
---
# Falha transitória e permanente

- **Transitória**: pode passar sozinha (timeout, 502, 503). Vale repetir com [[Backoff exponencial]].
- **Permanente**: repetir só repete o erro (cartão recusado, documento inválido, 4xx de validação). Levantamos `PermanentFailure` e `with_retry` não tenta de novo.

Classificar errado custa caro nos dois sentidos: repetir permanente irrita o cliente com várias recusas; desistir de transitória perde receita.
