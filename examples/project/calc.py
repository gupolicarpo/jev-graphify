from decimal import Decimal, ROUND_HALF_UP

def total(values):
    return sum(values)

def round_invoice(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
