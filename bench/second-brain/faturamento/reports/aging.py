"""Relatório de inadimplência por faixa de atraso."""
from collections import defaultdict
from datetime import date
from decimal import Decimal

BUCKETS = [(0, 30, "1-30"), (31, 60, "31-60"), (61, 90, "61-90"), (91, 10**6, "90+")]


def bucket_for(days_late: int) -> str:
    for lo, hi, nome in BUCKETS:
        if lo <= days_late <= hi:
            return nome
    return "a-vencer"


def build_aging_report(conn, today: date) -> dict:
    rows = conn.execute(
        "SELECT customer_id, total, due_date FROM invoices WHERE status = 'issued' AND due_date < %s", (today,)
    ).fetchall()
    faixas = defaultdict(lambda: Decimal("0"))
    por_cliente = defaultdict(lambda: defaultdict(lambda: Decimal("0")))
    for customer_id, total, due in rows:
        faixa = bucket_for((today - due).days)
        faixas[faixa] += Decimal(total)
        por_cliente[customer_id][faixa] += Decimal(total)
    return {"faixas": dict(faixas), "clientes": {k: dict(v) for k, v in por_cliente.items()}}
