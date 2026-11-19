---
tags: [como-fazer, nfse, runbook]
type: runbook
created: 2026-04-17
code: [taxes/nfse.py]
---
# Reemitir NFS-e rejeitada

Passo a passo para quando a prefeitura devolve a nota recusada.

1. Leia o motivo no retorno (`NfseStatus.REJECTED`) — os mais comuns: divergência de base, documento inválido, município inexistente.
2. Documento inválido? Valide com `validate_cnpj` antes de reenviar.
3. Divergência de base: confira se os valores foram truncados ([[D-12 Impostos são truncados, não arredondados]]).
4. Gere de novo o payload com `build_nfse_payload` **mantendo o mesmo RPS** e envie com `submit_nfse`.
5. Se houve timeout e a nota pode já existir, consulte antes de reenviar para não duplicar ([[RPS]]).

Histórico de um caso em massa: [[I-2026-06 NFS-e rejeitada em Curitiba]].
