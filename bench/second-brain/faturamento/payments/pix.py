"""Pix: cobrança imediata e webhook de confirmação."""
import hashlib
import hmac
import json

from .idempotency import IdempotencyStore, DuplicateRequest, make_key


class InvalidSignature(Exception):
    pass


def create_pix_charge(invoice, txid_prefix: str = "FAT") -> dict:
    return {
        "txid": f"{txid_prefix}{invoice.number.replace('-', '')}",
        "valor": str(invoice.amount_due()),
        "expiracao": 3600,
    }


def verify_signature(secret: str, body: bytes, signature: str) -> bool:
    esperado = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, signature)


def handle_pix_webhook(conn, secret: str, body: bytes, signature: str) -> dict:
    """Confirma o pagamento uma única vez, mesmo que o banco reenvie o webhook."""
    if not verify_signature(secret, body, signature):
        raise InvalidSignature("assinatura inválida")
    evento = json.loads(body)
    store = IdempotencyStore(conn)
    try:
        store.check_or_store(make_key("pix", evento["txid"], evento["e2eid"]), {"ok": True})
    except DuplicateRequest as dup:
        return dup.stored_response
    conn.execute("UPDATE invoices SET status = 'paid', paid_at = now() WHERE pix_txid = %s", (evento["txid"],))
    return {"ok": True}
