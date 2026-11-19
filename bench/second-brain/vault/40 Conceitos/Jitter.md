---
tags: [glossario, resiliencia]
type: conceito
---
# Jitter

Aleatoriedade somada ao tempo de espera para que clientes que falharam juntos não tentem juntos. Usamos ±25% do atraso calculado. Sem jitter, o backoff exponencial ainda sincroniza uma "manada" que falhou no mesmo segundo.

- [[Backoff exponencial]]
- [[D-26 Backoff exponencial com jitter]]
