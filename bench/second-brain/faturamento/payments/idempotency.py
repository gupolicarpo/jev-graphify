"""Chaves de idempotência para cobranças e webhooks."""
import hashlib
from datetime import datetime, timedelta, timezone


class DuplicateRequest(Exception):
    def __init__(self, key: str, stored_response: dict):
        super().__init__(f"requisição repetida: {key}")
        self.key = key
        self.stored_response = stored_response


def make_key(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


class IdempotencyStore:
    TTL = timedelta(hours=48)

    def __init__(self, conn):
        self.conn = conn

    def check_or_store(self, key: str, response: dict = None) -> None:
        row = self.conn.execute(
            "SELECT response FROM idempotency_keys WHERE key = %s AND created_at > %s",
            (key, datetime.now(timezone.utc) - self.TTL),
        ).fetchone()
        if row is not None:
            raise DuplicateRequest(key, row[0])
        self.conn.execute(
            "INSERT INTO idempotency_keys(key, response, created_at) VALUES (%s, %s, now())", (key, response or {})
        )

    def purge_expired(self) -> int:
        cur = self.conn.execute(
            "DELETE FROM idempotency_keys WHERE created_at < %s", (datetime.now(timezone.utc) - self.TTL,)
        )
        return cur.rowcount
