"""Agendador mínimo de jobs periódicos."""
import logging
import time
from dataclasses import dataclass
from typing import Callable

log = logging.getLogger(__name__)


@dataclass
class Job:
    name: str
    interval_seconds: int
    fn: Callable
    next_run: float = 0.0


def schedule_job(registry: list, name: str, interval_seconds: int, fn: Callable) -> Job:
    job = Job(name, interval_seconds, fn)
    registry.append(job)
    return job


def run_due_jobs(registry: list, now=None) -> list:
    agora = now if now is not None else time.time()
    executados = []
    for job in registry:
        if agora >= job.next_run:
            try:
                job.fn()
            except Exception:
                log.exception("job %s falhou", job.name)
            job.next_run = agora + job.interval_seconds
            executados.append(job.name)
    return executados
