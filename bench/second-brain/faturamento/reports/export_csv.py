"""Exportação de faturas para planilha: ponto e vírgula e vírgula decimal (Excel PT-BR)."""
import csv
import io

BOM = "﻿"


def _fmt_decimal(value) -> str:
    return str(value).replace(".", ",")


def export_invoices_csv(invoices) -> str:
    buf = io.StringIO()
    buf.write(BOM)
    w = csv.writer(buf, delimiter=";")
    w.writerow(["numero", "cliente", "emissao", "vencimento", "total", "status"])
    for inv in invoices:
        w.writerow([inv.number, inv.customer_id, inv.issue_date.isoformat(), inv.due_date.isoformat(),
                    _fmt_decimal(inv.total()), inv.status])
    return buf.getvalue()
