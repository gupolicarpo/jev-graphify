"""Validação de CPF e CNPJ (dígitos verificadores)."""


def _digits(value: str) -> str:
    return "".join(c for c in value if c.isdigit())


def validate_cpf(value: str) -> bool:
    d = _digits(value)
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        soma = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        dv = (soma * 10) % 11 % 10
        if dv != int(d[n]):
            return False
    return True


def validate_cnpj(value: str) -> bool:
    d = _digits(value)
    if len(d) != 14 or d == d[0] * 14:
        return False
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos2 = [6] + pesos1
    for pesos, pos in ((pesos1, 12), (pesos2, 13)):
        soma = sum(int(d[i]) * pesos[i] for i in range(pos))
        dv = 0 if soma % 11 < 2 else 11 - soma % 11
        if dv != int(d[pos]):
            return False
    return True
