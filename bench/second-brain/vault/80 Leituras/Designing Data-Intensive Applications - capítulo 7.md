---
tags: [leitura, livro, dados]
type: leitura
---
# DDIA — capítulo 7 (transações)

Níveis de isolamento: read committed, snapshot, serializable. Anomalias: dirty read, lost update, write skew. Lock de linha com `SELECT FOR UPDATE` evita lost update. Sobre idempotência: operações de escrita com chave de deduplicação são a forma mais simples de obter "exatamente uma vez" na prática. Livro excelente, difícil de ler de uma vez só.
