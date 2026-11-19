"""Cadastro de clientes."""
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class Customer:
    id: int
    name: str
    document: str
    city_ibge: str
    email: str
    phone: str = ""
    credit_limit: Decimal = Decimal("0")
    is_company: bool = True
    blocked: bool = False

    def display_name(self) -> str:
        return self.name.strip().title()

    def masked_document(self) -> str:
        d = "".join(c for c in self.document if c.isdigit())
        return d[:3] + ".***.***-" + d[-2:] if len(d) == 11 else d[:2] + ".***.***/****-" + d[-2:]
