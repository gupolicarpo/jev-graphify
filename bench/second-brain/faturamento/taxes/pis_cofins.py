"""PIS/COFINS cumulativo e não cumulativo."""
from decimal import Decimal

from .rounding import truncate_tax

PIS_CUMULATIVE = Decimal("0.0065")
COFINS_CUMULATIVE = Decimal("0.03")
PIS_NON_CUMULATIVE = Decimal("0.0165")
COFINS_NON_CUMULATIVE = Decimal("0.076")


def compute_pis_cofins(base: Decimal, regime: str = "presumido"):
    if regime == "lucro_real":
        pis, cofins = PIS_NON_CUMULATIVE, COFINS_NON_CUMULATIVE
    else:
        pis, cofins = PIS_CUMULATIVE, COFINS_CUMULATIVE
    return {"pis": truncate_tax(base * pis), "cofins": truncate_tax(base * cofins)}
