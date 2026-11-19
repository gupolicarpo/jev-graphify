"""Arredondamento de IMPOSTOS: trunca na segunda casa, como a prefeitura calcula.
Diferente de billing/rounding.py (valores da fatura, meio para cima)."""
from decimal import Decimal, ROUND_DOWN

CENT = Decimal("0.01")


def truncate_tax(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_DOWN)


def tax_base_after_deductions(gross: Decimal, deductions: Decimal) -> Decimal:
    base = gross - deductions
    return base if base > 0 else Decimal("0")
