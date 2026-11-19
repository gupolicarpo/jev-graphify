---
tags: [como-fazer, onboarding, ambiente]
type: howto
created: 2026-01-07
code: [config.py]
---
# Configurar o ambiente local

1. Instale Python 3.12 e Postgres 15.
2. Crie o banco `faturamento_dev`.
3. Copie `.env.example` para `.env`. Variáveis lidas por `load_settings` em `config.py`:
   - `DATABASE_URL`
   - `ERP_BASE_URL` (aponte para o mock local)
   - `NFSE_URL`
   - `PIX_WEBHOOK_SECRET`, `TOKEN_SECRET` (qualquer valor em desenvolvimento)
4. Rode as migrações e depois [[Rodar os testes]].

Os valores padrão são só para desenvolvimento e nunca devem ir para produção. Primeira semana de um dev novo: [[Onboarding de novos devs]].
