---
tags: [decisao, iss, impostos, retencao]
aliases: [Retenção ISS]
type: decisao
status: accepted
created: 2026-02-02
code: [taxes/iss.py]
---
# D-17 Retenção de ISS apenas para tomador PJ

Quando o tomador do serviço é pessoa jurídica **e** o município exige, o ISS é retido na fonte e o cliente paga a fatura menos o imposto (`Invoice.amount_due`).

Regras em `should_withhold`:
- tomador PF nunca retém;
- valor abaixo de R$ 10,00 não retém (piso de `WITHHOLDING_MIN_AMOUNT`);
- retém se o tomador está na cidade do prestador ou em município da tabela `ISS_RATES`.

`apply_iss_withholding` calcula e grava em `iss_withheld`, truncando conforme [[D-12 Impostos são truncados, não arredondados]]. A alíquota vem de `iss_rate_for_city`, indexada pelo [[Código IBGE do município]]. Dúvidas do Rafael sobre municípios de fora da tabela estão em [[2026-05-05 Reunião de impostos e IBGE]].

Ver também [[Retenção na fonte]].
