---
tags: [decisao, conciliacao, boleto]
type: decisao
status: accepted
created: 2026-03-26
supersedes: "[[D-13 Conciliação aceita diferença de um centavo]]"
code: [payments/boleto.py]
---
# D-20 Conciliação tolera até cinco centavos

Depois do alinhamento com o financeiro ([[2026-03-24 Alinhamento com o financeiro sobre conciliação]]), a tolerância de divergência na baixa subiu para **R$ 0,05** (comparação em `reconcile_boleto`). Pagamento dentro da tolerância baixa a fatura; fora dela vai para a lista de divergentes.

Racional: diferenças de multa/juros por arredondamento diário dos bancos raramente passam de 4 centavos. Acima disso quase sempre é erro real (valor digitado errado, pagamento parcial).

Não aumentar sem falar com o Paulo (financeiro): é ele quem assina a política contábil.
