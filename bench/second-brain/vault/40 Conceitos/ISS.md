---
tags: [glossario, impostos, iss]
aliases: [Imposto Sobre Serviços]
type: conceito
created: 2025-10-20
---
# ISS

Imposto municipal sobre serviços. A alíquota varia de 2% a 5% conforme a cidade e o tipo de serviço. Para nós, importa em três lugares:

1. quanto aparece na NFS-e (`aliquota_iss` em `build_nfse_payload`);
2. se é retido pelo tomador ([[Retenção na fonte]]);
3. como é calculado: truncado na segunda casa ([[Truncamento versus arredondamento]]).

Tabela de alíquotas: `ISS_RATES` em `taxes/iss.py`, indexada por [[Código IBGE do município]]. Município fora da tabela usa `DEFAULT_ISS_RATE` (5%), o que pode estar errado — confirmar com o contador.
