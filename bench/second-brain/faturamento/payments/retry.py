"""Política de nova tentativa para chamadas a gateways: backoff exponencial com jitter (D-26)."""
import random
import time
from dataclasses import dataclass


class PermanentFailure(Exception):
    """Erro que não adianta repetir (cartão recusado, documento inválido)."""


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 6
    base_delay: float = 2.0
    max_delay: float = 300.0
    jitter: float = 0.25

    def delay_for(self, attempt: int) -> float:
        bruto = min(self.max_delay, self.base_delay * (2 ** (attempt - 1)))
        folga = bruto * self.jitter
        return max(0.0, bruto + random.uniform(-folga, folga))


def with_retry(fn, policy: RetryPolicy = RetryPolicy(), sleep=time.sleep):
    ultima = None
    for attempt in range(1, policy.max_attempts + 1):
        try:
            return fn()
        except PermanentFailure:
            raise
        except Exception as exc:  # falha transitória
            ultima = exc
            if attempt == policy.max_attempts:
                break
            sleep(policy.delay_for(attempt))
    raise ultima
