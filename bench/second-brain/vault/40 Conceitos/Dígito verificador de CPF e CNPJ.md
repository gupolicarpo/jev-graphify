---
tags: [glossario, clientes, validacao]
aliases: [validar CPF, validar CNPJ]
type: conceito
---
# Dígito verificador de CPF e CNPJ

Os dois últimos dígitos de um CPF (11 dígitos) e de um CNPJ (14) são calculados a partir dos anteriores com pesos fixos e módulo 11. Validar antes de cadastrar evita NFS-e rejeitada por documento inválido. Sequências repetidas (`111.111.111-11`) passam na conta mas são inválidas; rejeitamos explicitamente.

Código: `validate_cpf` e `validate_cnpj` em `customers/documents.py`. A máscara na tela usa `Customer.masked_document`.
