---
tags: [glossario, boleto]
aliases: [nosso_numero, NN]
type: conceito
---
# Nosso número

Identificador do boleto **dentro do banco emissor**, 10 dígitos para nós. É a chave que usamos para casar o pagamento do arquivo de retorno com a fatura. Geramos a partir do número da fatura sem o hífen, completando com zeros à esquerda (`generate_boleto`).

Não confundir com "seu número" (o código do cedente) nem com a linha digitável. Duas faturas nunca podem compartilhar o mesmo nosso número no mesmo banco; se compartilharem, a conciliação ([[D-15 Conciliação de boleto pelo retorno CNAB diário]]) trata a segunda como duplicada.

Relacionados: [[Boleto]], [[Arquivo de retorno CNAB]].
