---
tags: [como-fazer, runbook, boleto, cnab]
type: runbook
created: 2026-03-11
code: [payments/boleto.py]
---
# Reprocessar o arquivo de retorno CNAB

Use quando o banco avisar que reenviou um arquivo ou quando uma linha foi rejeitada por formato.

- [ ] Baixe o arquivo do dia e confira o nome (data e sequencial).
- [ ] Rode a conciliação em modo simulação e leia as três listas devolvidas por `reconcile_boleto`.
- [ ] `duplicadas` vazia? Então o arquivo é inédito. Se não, confirme com o banco antes de agir.
- [ ] Divergentes: abra chamado para o financeiro, **não** force baixa.
- [ ] Rode em modo real. Reprocessar é seguro: baixas repetidas são ignoradas (ver [[I-2026-04 Boleto pago em duplicidade]]).

Contexto das regras: [[D-15 Conciliação de boleto pelo retorno CNAB diário]].
