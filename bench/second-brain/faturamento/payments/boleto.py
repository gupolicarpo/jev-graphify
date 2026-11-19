"""Boleto bancário: geração, vencimento em dia útil e conciliação do arquivo de retorno."""
from datetime import date, timedelta
from decimal import Decimal

from config import load_settings

FERIADOS_NACIONAIS = {(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (12, 25)}


def boleto_due_date(requested: date) -> date:
    d = requested
    while d.weekday() >= 5 or (d.month, d.day) in FERIADOS_NACIONAIS:
        d += timedelta(days=1)
    return d


def generate_boleto(invoice, bank_code: str = "341") -> dict:
    nosso_numero = invoice.number.replace("-", "")[-10:].zfill(10)
    return {
        "nosso_numero": nosso_numero,
        "valor": str(invoice.amount_due()),
        "vencimento": boleto_due_date(invoice.due_date).isoformat(),
        "banco": bank_code,
    }


def parse_retorno_line(line: str) -> dict:
    """Linha de detalhe simplificada do CNAB 400 de retorno."""
    return {
        "nosso_numero": line[62:72].strip(),
        "valor_pago": Decimal(line[152:165]) / Decimal(100),
        "data_pagamento": date(2000 + int(line[110:112]), int(line[108:110]), int(line[106:108])),
        "ocorrencia": line[108 - 106 : 110 - 106],
    }


def reconcile_boleto(conn, retorno_lines, settings=None) -> dict:
    """Casa cada pagamento do retorno com a fatura. Pagamento duplicado do mesmo nosso_numero é ignorado."""
    settings = settings or load_settings()
    baixadas, duplicadas, divergentes = [], [], []
    vistos = set()
    for line in retorno_lines:
        reg = parse_retorno_line(line)
        nn = reg["nosso_numero"]
        if nn in vistos:
            duplicadas.append(nn)
            continue
        vistos.add(nn)
        row = conn.execute("SELECT id, total, status FROM invoices WHERE nosso_numero = %s", (nn,)).fetchone()
        if row is None or row[2] == "paid":
            duplicadas.append(nn)
        elif abs(Decimal(row[1]) - reg["valor_pago"]) > Decimal("0.05"):
            divergentes.append(nn)
        else:
            conn.execute("UPDATE invoices SET status = 'paid', paid_at = %s WHERE id = %s", (reg["data_pagamento"], row[0]))
            baixadas.append(nn)
    return {"baixadas": baixadas, "duplicadas": duplicadas, "divergentes": divergentes}
