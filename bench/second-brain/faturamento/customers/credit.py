"""Limite de crédito: bloqueia nova emissão quando o saldo em aberto estoura o limite."""
from decimal import Decimal


class CreditLimitExceeded(Exception):
    pass


def open_balance(conn, customer_id: int) -> Decimal:
    row = conn.execute(
        "SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = %s AND status = 'issued'",
        (customer_id,),
    ).fetchone()
    return Decimal(row[0])


def credit_limit_check(conn, customer, new_amount: Decimal) -> None:
    if customer.blocked:
        raise CreditLimitExceeded("cliente bloqueado")
    if customer.credit_limit <= 0:
        return  # sem limite configurado
    if open_balance(conn, customer.id) + new_amount > customer.credit_limit:
        raise CreditLimitExceeded(f"limite de {customer.credit_limit} excedido")
