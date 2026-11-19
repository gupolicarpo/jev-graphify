"""Cliente HTTP do ERP do cliente (contas a receber)."""
from payments.retry import RetryPolicy, with_retry


class ErpSyncError(Exception):
    def __init__(self, message: str, invoice_number: str = ""):
        super().__init__(message)
        self.invoice_number = invoice_number


class ErpClient:
    def __init__(self, http_client, base_url: str, api_token: str, policy: RetryPolicy = None):
        self.http = http_client
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {api_token}"}
        self.policy = policy or RetryPolicy(max_attempts=4)

    def post_receivable(self, payload: dict) -> str:
        def _call():
            r = self.http.post(f"{self.base_url}/contas-a-receber", json=payload, headers=self.headers)
            if r.status_code == 409:
                return r.json()["id"]  # já existe: trata como sucesso
            if r.status_code >= 400:
                raise ErpSyncError(f"ERP respondeu {r.status_code}", payload.get("numero", ""))
            return r.json()["id"]
        return with_retry(_call, self.policy)
