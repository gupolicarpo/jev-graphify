"""Lembretes por WhatsApp (API oficial, só com opt-in do cliente)."""


class OptInRequired(Exception):
    pass


def send_whatsapp_reminder(http_client, base_url: str, customer, message: str) -> str:
    if not customer.phone:
        raise OptInRequired("cliente sem telefone cadastrado")
    resp = http_client.post(f"{base_url}/messages", json={"to": customer.phone, "text": message})
    resp.raise_for_status()
    return resp.json()["id"]
