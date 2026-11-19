"""ISS: alíquota por município e retenção na fonte."""
from decimal import Decimal

from .rounding import truncate_tax

ISS_RATES = {
    "3550308": Decimal("0.05"),  # São Paulo
    "3304557": Decimal("0.05"),  # Rio de Janeiro
    "3106200": Decimal("0.03"),  # Belo Horizonte
    "4106902": Decimal("0.05"),  # Curitiba
}
DEFAULT_ISS_RATE = Decimal("0.05")
WITHHOLDING_MIN_AMOUNT = Decimal("10.00")


def iss_rate_for_city(ibge_code: str) -> Decimal:
    return ISS_RATES.get(ibge_code, DEFAULT_ISS_RATE)


def should_withhold(customer_is_company: bool, customer_city: str, provider_city: str, amount: Decimal) -> bool:
    """Retém quando o tomador é PJ e o serviço é prestado em município que exige retenção."""
    if not customer_is_company:
        return False
    if amount < WITHHOLDING_MIN_AMOUNT:
        return False
    return customer_city == provider_city or customer_city in ISS_RATES


def apply_iss_withholding(invoice, customer, provider_city: str):
    """Calcula o ISS retido e grava na fatura. Devolve o valor retido (zero se não retém)."""
    total = invoice.total()
    if not should_withhold(customer.is_company, customer.city_ibge, provider_city, total):
        invoice.iss_withheld = Decimal("0")
        return invoice.iss_withheld
    taxa = iss_rate_for_city(customer.city_ibge)
    invoice.iss_withheld = truncate_tax(total * taxa)
    return invoice.iss_withheld
