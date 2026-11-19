---
tags: [reuniao, retry, pagamentos]
type: reuniao
date: 2026-03-03
participantes: [Marina, Beatriz, Diego]
---
# Conversa sobre retry do gateway

Dia seguinte à queda de cobrança ([[I-2026-03 Fila de cobrança derrubou o gateway]]).

**Beatriz:** o gráfico mostra ondas de 30 em 30 segundos. Isso é a nossa fila.
**Marina:** a gente já sabia que intervalo fixo era ruim, só não esperava este volume.
**Diego:** proponho dobrar o intervalo a cada falha.
**Marina:** dobrar sem aleatoriedade ainda sincroniza. Precisa de jitter. E erro de cartão recusado não deve repetir nunca.
**Beatriz:** teto de espera de 5 minutos, senão a fila cresce sem fim.

Decidido em princípio; Marina escreve a ADR. Resultado formal: [[D-26 Backoff exponencial com jitter]] (note que na reunião ainda se falava em "dobrar", os números finais mudaram depois).
