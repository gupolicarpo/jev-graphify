---
tags: [glossario, impostos]
aliases: [IBGE, código do município]
type: conceito
---
# Código IBGE do município

Número de 7 dígitos que identifica cada município (São Paulo = 3550308, Curitiba = 4106902). É a chave de toda tabela fiscal municipal: alíquota de ISS, regra de retenção, endpoint do provedor de NFS-e. Guardamos no cadastro do cliente como city_ibge.

Nunca use o nome da cidade como chave: "São Paulo" tem variações de grafia e há cidades homônimas em estados diferentes. Aplicação prática em [[D-17 Retenção de ISS apenas para tomador PJ]] e em [[Cadastrar um município novo no ISS]].
