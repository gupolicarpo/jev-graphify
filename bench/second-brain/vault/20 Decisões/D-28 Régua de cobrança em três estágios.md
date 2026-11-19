---
tags: [decisao, cobranca, inadimplencia]
aliases: [Dunning, Régua 1-7-15]
type: decisao
status: accepted
created: 2026-06-04
supersedes: "[[D-08 Cobrança em dois avisos]]"
code: [jobs/dunning.py, notifications/templates.py]
---
# D-28 Régua de cobrança em três estágios

| Estágio | Atraso mínimo | Tom da mensagem |
|---|---|---|
| 1 | 1 dia | lembrete amigável |
| 2 | 7 dias | oferece segunda via |
| 3 | 15 dias | aviso final de suspensão |

`stage_for_delay` descobre o estágio; `run_dunning_cycle` envia só quando o estágio novo é maior que o gravado em `dunning_stage` — nunca repete o mesmo aviso. Textos em `DUNNING_STAGES`, renderizados por `render_dunning_message`.

Substitui [[D-08 Cobrança em dois avisos]]. Alinhamento: [[2026-06-02 Alinhamento da régua de cobrança]]. Projeto: [[Régua de cobrança por WhatsApp]].
