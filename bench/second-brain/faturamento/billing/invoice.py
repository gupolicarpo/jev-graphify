"""Modelo de fatura e itens."""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import List, Optional

from .rounding import round_item_amount, round_invoice_total


@dataclass
class InvoiceItem:
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0")
    service_code: Optional[str] = None

    @property
    def gross_amount(self) -> Decimal:
        return self.quantity * self.unit_price

    @property
    def net_amount(self) -> Decimal:
        # valor do item já arredondado, regra D-19
        bruto = self.gross_amount * (Decimal("1") - self.discount_pct / Decimal("100"))
        return round_item_amount(bruto)


@dataclass
class Invoice:
    number: str
    customer_id: int
    issue_date: date
    due_date: date
    items: List[InvoiceItem] = field(default_factory=list)
    status: str = "draft"
    iss_withheld: Decimal = Decimal("0")
    series: str = "A"

    def add_item(self, item: InvoiceItem) -> None:
        if self.status != "draft":
            raise ValueError("fatura emitida não aceita novos itens")
        self.items.append(item)

    def total(self) -> Decimal:
        return round_invoice_total([i.net_amount for i in self.items])

    def amount_due(self) -> Decimal:
        return self.total() - self.iss_withheld

    def issue(self) -> None:
        if not self.items:
            raise ValueError("fatura sem itens")
        self.status = "issued"

    def is_overdue(self, today: date) -> bool:
        return self.status == "issued" and today > self.due_date
