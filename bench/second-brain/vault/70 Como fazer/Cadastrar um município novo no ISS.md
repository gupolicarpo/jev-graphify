---
tags: [como-fazer, impostos, iss]
type: howto
---
# Cadastrar um município novo no ISS

1. Descubra o [[Código IBGE do município]] (7 dígitos).
2. Confirme a alíquota com o contador — nunca com site genérico.
3. Adicione a entrada em `ISS_RATES` (`taxes/iss.py`) e crie teste para `iss_rate_for_city`.
4. Verifique se o município exige retenção; se exigir, ele passa a entrar em `should_withhold` automaticamente por estar na tabela.
5. Peça ao Rafael para revisar.
