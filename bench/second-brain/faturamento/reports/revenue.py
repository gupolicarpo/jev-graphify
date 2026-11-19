"""Resumo mensal de receita reconhecida."""
from decimal import Decimal


def monthly_revenue_summary(conn, year: int, month: int) -> dict:
    rows = conn.execute(
        "SELECT status, COALESCE(SUM(total), 0), COUNT(*) FROM invoices "
        "WHERE EXTRACT(year FROM issue_date) = %s AND EXTRACT(month FROM issue_date) = %s GROUP BY status",
        (year, month),
    ).fetchall()
    resumo = {s: {"total": Decimal(t), "quantidade": n} for s, t, n in rows}
    emitido = sum((v["total"] for v in resumo.values()), Decimal("0"))
    recebido = resumo.get("paid", {"total": Decimal("0")})["total"]
    return {"emitido": emitido, "recebido": recebido, "por_status": resumo}
