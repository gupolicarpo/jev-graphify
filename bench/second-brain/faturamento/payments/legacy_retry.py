"""DEPRECADO (D-11, substituída por D-26): tentativa em intervalo fixo. Mantido só para o job antigo de conciliação."""
import time


def fixed_interval_retry(fn, attempts: int = 3, interval: float = 30.0, sleep=time.sleep):
    for i in range(attempts):
        try:
            return fn()
        except Exception:
            if i == attempts - 1:
                raise
            sleep(interval)
