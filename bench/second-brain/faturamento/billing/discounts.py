"""Descontos comerciais aplicados antes do arredondamento do item."""
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional


@dataclass(frozen=True)
class DiscountRule:
    code: str
    percent: Decimal
    min_quantity: int = 1
    valid_until: Optional[str] = None


def apply_discount(unit_price: Decimal, quantity: int, rule: Optional[DiscountRule]) -> Decimal:
    """Devolve o preço unitário efetivo; não arredonda (quem arredonda é round_item_amount)."""
    if rule is None or quantity < rule.min_quantity:
        return unit_price
    return unit_price * (Decimal("1") - rule.percent / Decimal("100"))


def stack_discounts(unit_price: Decimal, quantity: int, rules: list) -> Decimal:
    """Descontos não se somam: aplicam em cascata, na ordem recebida."""
    preco = unit_price
    for r in rules:
        preco = apply_discount(preco, quantity, r)
    return preco
