"""Sincronização incremental de faturas com o ERP, em lotes e com cursor."""
import logging

from .client import ErpClient, ErpSyncError
from .mapping import map_invoice_to_erp

log = logging.getLogger(__name__)


def sync_invoices_to_erp(conn, erp: ErpClient, load_invoice, load_customer, batch_size: int = 200) -> dict:
    cursor = conn.execute("SELECT value FROM sync_cursors WHERE name = 'erp'").fetchone()
    ultimo = cursor[0] if cursor else 0
    ids = [r[0] for r in conn.execute(
        "SELECT id FROM invoices WHERE id > %s AND status IN ('issued','paid') ORDER BY id LIMIT %s",
        (ultimo, batch_size),
    ).fetchall()]
    enviados, falhas = 0, []
    for inv_id in ids:
        inv = load_invoice(inv_id)
        try:
            erp.post_receivable(map_invoice_to_erp(inv, load_customer(inv.customer_id)))
            enviados += 1
            ultimo = inv_id
        except ErpSyncError as exc:
            log.warning("falha ao sincronizar %s: %s", exc.invoice_number, exc)
            falhas.append(exc.invoice_number)
            break  # preserva a ordem: não avança o cursor além da falha
    conn.execute("UPDATE sync_cursors SET value = %s WHERE name = 'erp'", (ultimo,))
    return {"enviados": enviados, "falhas": falhas, "cursor": ultimo}
