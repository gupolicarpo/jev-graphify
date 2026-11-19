---
tags: [glossario, boleto, cnab]
aliases: [retorno CNAB, CNAB 400]
type: conceito
---
# Arquivo de retorno CNAB

Arquivo de texto posicional que o banco publica diariamente com liquidações, baixas e rejeições dos boletos. Formato CNAB 400 em colunas fixas: o *nosso número* fica nas posições 63–72, o valor pago mais adiante.

No nosso código o parse fica em `parse_retorno_line` (simplificado: só os campos que usamos). Datas vêm em dia/mês/ano de dois dígitos — cuidado com o século.

Arquivos podem ser reenviados pelo banco; por isso a conciliação precisa ser segura contra repetição. Veja [[Conciliação bancária]] e [[Reprocessar o arquivo de retorno CNAB]].
