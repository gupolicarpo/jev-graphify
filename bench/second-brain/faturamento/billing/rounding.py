"""Arredondamento de valores da fatura (não confundir com taxes/rounding.py, que trunca impostos)."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List

CENT = Decimal("0.01")


def round_item_amount(value: Decimal) -> Decimal:
    """Arredonda o valor de UM item para centavos, meio para cima."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def distribute_residual_cent(amounts: List[Decimal], expected_total: Decimal) -> List[Decimal]:
    """Quando o total esperado difere da soma dos itens por centavos, joga a sobra no maior item."""
    soma = sum(amounts, Decimal("0"))
    sobra = expected_total - soma
    if sobra == 0 or not amounts:
        return list(amounts)
    ajustado = list(amounts)
    idx = max(range(len(ajustado)), key=lambda i: ajustado[i])
    ajustado[idx] += sobra
    return ajustado


def round_invoice_total(item_amounts: List[Decimal]) -> Decimal:
    """Total da fatura = soma dos itens JÁ arredondados. Nunca arredonda a soma bruta."""
    total = sum((round_item_amount(a) for a in item_amounts), Decimal("0"))
    return total.quantize(CENT)


def installment_split(total: Decimal, parts: int) -> List[Decimal]:
    """Divide o total em parcelas; o resto de centavos vai para a primeira parcela."""
    if parts < 1:
        raise ValueError("parts deve ser >= 1")
    base = (total / parts).quantize(CENT, rounding=ROUND_HALF_UP)
    out = [base] * parts
    out[0] += total - base * parts
    return out
