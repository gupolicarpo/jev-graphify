"""Configuração central do faturamento. Valores vêm do ambiente; nada de segredo no repositório."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    erp_base_url: str
    nfse_provider_url: str
    pix_webhook_secret: str
    token_secret: str
    token_ttl_seconds: int = 3600
    max_retry_attempts: int = 6
    retry_base_delay_seconds: float = 2.0
    boleto_grace_days: int = 3
    erp_batch_size: int = 200


def load_settings(env=None) -> Settings:
    env = env if env is not None else os.environ
    return Settings(
        database_url=env.get("DATABASE_URL", "postgresql://localhost/faturamento_dev"),
        erp_base_url=env.get("ERP_BASE_URL", "https://erp.exemplo.invalid"),
        nfse_provider_url=env.get("NFSE_URL", "https://nfse.exemplo.invalid"),
        pix_webhook_secret=env.get("PIX_WEBHOOK_SECRET", "dev-only-not-a-secret"),
        token_secret=env.get("TOKEN_SECRET", "dev-only-not-a-secret"),
        token_ttl_seconds=int(env.get("TOKEN_TTL", "3600")),
        max_retry_attempts=int(env.get("MAX_RETRY", "6")),
        erp_batch_size=int(env.get("ERP_BATCH", "200")),
    )
