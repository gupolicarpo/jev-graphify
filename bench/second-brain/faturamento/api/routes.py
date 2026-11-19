"""Rotas da API (framework omitido: funções puras que recebem o contexto)."""
from datetime import date
from decimal import Decimal

from auth.permissions import require_role
from auth.tokens import verify_access_token
from billing.invoice import Invoice, InvoiceItem
from billing.numbering import next_invoice_number
from customers.credit import credit_limit_check
from payments.boleto import generate_boleto
from payments.pix import handle_pix_webhook
from taxes.iss import apply_iss_withholding


@require_role("operator")
def create_invoice(claims: dict, ctx, body: dict) -> dict:
    cliente = ctx.load_customer(body["customer_id"])
    inv = Invoice(
        number=next_invoice_number(ctx.conn),
        customer_id=cliente.id,
        issue_date=date.today(),
        due_date=date.fromisoformat(body["due_date"]),
    )
    for it in body["items"]:
        inv.add_item(InvoiceItem(it["description"], Decimal(it["quantity"]), Decimal(it["unit_price"]),
                                 Decimal(it.get("discount_pct", "0"))))
    credit_limit_check(ctx.conn, cliente, inv.total())
    apply_iss_withholding(inv, cliente, ctx.provider_city)
    inv.issue()
    return {"numero": inv.number, "total": str(inv.total()), "a_pagar": str(inv.amount_due())}


@require_role("viewer")
def get_boleto(claims: dict, ctx, invoice_number: str) -> dict:
    return generate_boleto(ctx.load_invoice_by_number(invoice_number))


def pix_webhook(ctx, headers: dict, raw_body: bytes) -> dict:
    return handle_pix_webhook(ctx.conn, ctx.settings.pix_webhook_secret, raw_body, headers.get("X-Signature", ""))


def authenticate(ctx, headers: dict) -> dict:
    token = headers.get("Authorization", "").removeprefix("Bearer ")
    return verify_access_token(ctx.settings.token_secret, token)
