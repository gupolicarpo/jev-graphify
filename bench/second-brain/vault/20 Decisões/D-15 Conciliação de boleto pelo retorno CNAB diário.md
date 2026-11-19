---
tags: [decisao, conciliacao, boleto, cnab]
type: decisao
status: accepted
created: 2026-01-20
code: [payments/boleto.py]
---
# D-15 Conciliação de boleto pelo retorno CNAB diário

Baixamos boletos lendo o arquivo de retorno que o banco publica toda manhã. Cada linha de detalhe vira um registro via `parse_retorno_line` e é casada por *nosso número* em `reconcile_boleto`.

Resultado da função: três listas — baixadas, duplicadas e divergentes. Duplicada significa que o mesmo nosso número apareceu duas vezes no arquivo ou a fatura já estava paga; **não** gera segunda baixa.

Não usamos consulta online por boleto: o banco limita a 60 consultas por minuto e temos milhares de títulos. Ver [[Nosso número]], [[Arquivo de retorno CNAB]] e a operação em [[Reprocessar o arquivo de retorno CNAB]].
