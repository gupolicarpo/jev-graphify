"""Tradução da fatura para o layout do ERP."""
ERP_STATUS = {"issued": "ABERTO", "paid": "LIQUIDADO", "cancelled": "CANCELADO"}


def map_invoice_to_erp(invoice, customer) -> dict:
    return {
        "numero": invoice.number,
        "cliente_documento": customer.document,
        "emissao": invoice.issue_date.isoformat(),
        "vencimento": invoice.due_date.isoformat(),
        "valor": str(invoice.total()),
        "retencao_iss": str(invoice.iss_withheld),
        "situacao": ERP_STATUS.get(invoice.status, "ABERTO"),
    }
