---
tags: [como-fazer, testes]
type: howto
---
# Rodar os testes

```bash
pytest -q
pytest tests/billing -k rounding
```

- Testes de dinheiro devem usar `Decimal("...")` de string, nunca float ([[D-02 Dinheiro sempre em Decimal]]).
- Testes de integração com o ERP usam um servidor falso e não precisam de rede.
- Se o teste de conciliação de boleto falhar só na CI, confira o fuso do relógio.
