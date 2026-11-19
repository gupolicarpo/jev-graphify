"""Geração mensal de faturas de assinaturas."""
import logging
from datetime import date, timedelta
from decimal import Decimal

from .invoice import Invoice, InvoiceItem
from .numbering import next_invoice_number

log = logging.getLogger(__name__)


def generate_recurring_invoices(conn, reference: date) -> int:
    """Gera as faturas do dia de vencimento de cada assinatura ativa. Devolve quantas criou."""
    criadas = 0
    subs = conn.execute(
        "SELECT id, customer_id, plan_name, price, billing_day FROM subscriptions "
        "WHERE active AND billing_day = %s", (reference.day,)
    ).fetchall()
    for sub_id, customer_id, plan, price, _ in subs:
        if _already_billed(conn, sub_id, reference):
            continue
        inv = Invoice(
            number=next_invoice_number(conn),
            customer_id=customer_id,
            issue_date=reference,
            due_date=reference + timedelta(days=10),
        )
        inv.add_item(InvoiceItem(description=f"Assinatura {plan}", quantity=Decimal("1"), unit_price=Decimal(price)))
        inv.issue()
        conn.execute(
            "INSERT INTO invoices(number, customer_id, subscription_id, issue_date, due_date, total) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (inv.number, customer_id, sub_id, inv.issue_date, inv.due_date, inv.total()),
        )
        criadas += 1
    log.info("faturas recorrentes geradas: %d", criadas)
    return criadas


def _already_billed(conn, sub_id: int, reference: date) -> bool:
    row = conn.execute(
        "SELECT 1 FROM invoices WHERE subscription_id = %s AND date_trunc('month', issue_date) = date_trunc('month', %s::date)",
        (sub_id, reference),
    ).fetchone()
    return row is not None
