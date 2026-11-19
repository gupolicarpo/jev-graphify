---
tags: [como-fazer, cobranca]
type: howto
code: [jobs/dunning.py, jobs/scheduler.py]
---
Para rodar o ciclo de cobrança manualmente (ex.: o job do dia falhou):

- Chame `run_dunning_cycle` com a data de hoje. Não precisa mexer no agendador (`schedule_job` só registra; `run_due_jobs` executa).
- É seguro rodar duas vezes no dia: o estágio gravado impede mensagem repetida.
- Antes de rodar em lote grande, conte quantos clientes têm telefone cadastrado — quem não tem é pulado.
