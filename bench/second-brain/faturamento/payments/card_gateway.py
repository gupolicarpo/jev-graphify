"""Cobrança em cartão via gateway externo."""
from dataclasses import dataclass
from decimal import Decimal

from .retry import RetryPolicy, with_retry, PermanentFailure


@dataclass
class ChargeResult:
    authorization_id: str
    approved: bool
    declined_reason: str = ""


class CardGateway:
    def __init__(self, http_client, api_base: str, policy: RetryPolicy = None):
        self.http = http_client
        self.api_base = api_base
        self.policy = policy or RetryPolicy()

    def charge_card(self, token: str, amount: Decimal, idempotency_key: str) -> ChargeResult:
        def _call():
            resp = self.http.post(
                f"{self.api_base}/charges",
                json={"token": token, "amount": str(amount)},
                headers={"Idempotency-Key": idempotency_key},
            )
            if resp.status_code == 402:
                raise PermanentFailure(resp.json().get("reason", "recusado"))
            if resp.status_code >= 500:
                raise RuntimeError(f"gateway {resp.status_code}")
            dados = resp.json()
            return ChargeResult(dados["id"], dados["status"] == "approved", dados.get("reason", ""))

        try:
            return with_retry(_call, self.policy)
        except PermanentFailure as exc:
            return ChargeResult("", False, str(exc))
