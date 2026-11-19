"""Estornos totais e parciais."""
from decimal import Decimal


class RefundNotAllowed(Exception):
    pass


def issue_refund(conn, invoice_id: int, amount: Decimal, reason: str) -> int:
    row = conn.execute("SELECT total, refunded, status FROM invoices WHERE id = %s", (invoice_id,)).fetchone()
    if row is None or row[2] != "paid":
        raise RefundNotAllowed("só faturas pagas podem ser estornadas")
    total, ja_estornado, _ = Decimal(row[0]), Decimal(row[1]), row[2]
    if amount <= 0 or ja_estornado + amount > total:
        raise RefundNotAllowed("valor de estorno inválido")
    cur = conn.execute(
        "INSERT INTO refunds(invoice_id, amount, reason) VALUES (%s,%s,%s) RETURNING id", (invoice_id, amount, reason)
    )
    conn.execute("UPDATE invoices SET refunded = refunded + %s WHERE id = %s", (amount, invoice_id))
    return cur.fetchone()[0]
