---
tags: [glossario, resiliencia]
type: conceito
---
# Backoff exponencial

Esperar mais a cada falha consecutiva: base × 2^(tentativa-1). Com base de 2 s: 2, 4, 8, 16, 32… Evita sobrecarregar um serviço que já está com problema. Quase sempre combinado com [[Jitter]].

Aplicação aqui: `RetryPolicy.delay_for` limita o crescimento a `max_delay` (300 s). Decisão: [[D-26 Backoff exponencial com jitter]].
