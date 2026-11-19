"""Ciclo diário de cobrança de faturas vencidas."""
from datetime import date

from notifications.templates import render_dunning_message
from notifications.whatsapp import send_whatsapp_reminder, OptInRequired

STAGE_AFTER_DAYS = {1: 1, 2: 7, 3: 15}


def stage_for_delay(days_late: int) -> int:
    estagio = 0
    for st, dias in STAGE_AFTER_DAYS.items():
        if days_late >= dias:
            estagio = st
    return estagio


def run_dunning_cycle(conn, http_client, whatsapp_url: str, load_customer, today: date) -> dict:
    enviados = pulados = 0
    rows = conn.execute(
        "SELECT id, number, customer_id, due_date, dunning_stage FROM invoices WHERE status = 'issued' AND due_date < %s",
        (today,),
    ).fetchall()
    for inv_id, number, customer_id, due, stage_atual in rows:
        novo = stage_for_delay((today - due).days)
        if novo <= (stage_atual or 0):
            pulados += 1
            continue
        class _Inv:  # só o necessário para renderizar a mensagem
            pass
        inv = _Inv()
        inv.number, inv.due_date = number, due
        try:
            send_whatsapp_reminder(http_client, whatsapp_url, load_customer(customer_id), render_dunning_message(novo, inv))
        except OptInRequired:
            pulados += 1
            continue
        conn.execute("UPDATE invoices SET dunning_stage = %s WHERE id = %s", (novo, inv_id))
        enviados += 1
    return {"enviados": enviados, "pulados": pulados}
