"""Pro rata de assinaturas no meio do ciclo (mês comercial de 30 dias)."""
from datetime import date
from decimal import Decimal

COMMERCIAL_MONTH_DAYS = 30


def days_remaining(start: date, cycle_end: date) -> int:
    return max(0, min(COMMERCIAL_MONTH_DAYS, (cycle_end - start).days + 1))


def prorate_subscription(monthly_price: Decimal, start: date, cycle_end: date) -> Decimal:
    dias = days_remaining(start, cycle_end)
    return monthly_price * Decimal(dias) / Decimal(COMMERCIAL_MONTH_DAYS)


def prorate_upgrade(old_price: Decimal, new_price: Decimal, change_date: date, cycle_end: date) -> Decimal:
    """Diferença cobrada na troca de plano; crédito do plano antigo já abatido."""
    dias = days_remaining(change_date, cycle_end)
    return (new_price - old_price) * Decimal(dias) / Decimal(COMMERCIAL_MONTH_DAYS)
