"""Montagem e envio da NFS-e ao provedor municipal."""
import json
import urllib.request
from enum import Enum

from .iss import iss_rate_for_city


class NfseStatus(Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


def build_nfse_payload(invoice, customer, provider_cnpj: str) -> dict:
    return {
        "prestador": {"cnpj": provider_cnpj},
        "tomador": {"documento": customer.document, "razao_social": customer.name, "municipio": customer.city_ibge},
        "rps": {"numero": invoice.number, "serie": invoice.series, "data": invoice.issue_date.isoformat()},
        "servico": {
            "valor": str(invoice.total()),
            "aliquota_iss": str(iss_rate_for_city(customer.city_ibge)),
            "iss_retido": invoice.iss_withheld > 0,
            "itens": [{"descricao": i.description, "valor": str(i.net_amount)} for i in invoice.items],
        },
    }


def submit_nfse(base_url: str, payload: dict, timeout: float = 20.0) -> NfseStatus:
    req = urllib.request.Request(
        base_url + "/rps", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        corpo = json.loads(resp.read())
    return NfseStatus(corpo.get("status", "pending"))
