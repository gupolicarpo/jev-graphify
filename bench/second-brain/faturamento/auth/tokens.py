"""Tokens de acesso assinados com HMAC (formato simples, sem biblioteca externa)."""
import base64
import hashlib
import hmac
import json
import time


class TokenError(Exception):
    pass


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def issue_access_token(secret: str, user_id: int, role: str, ttl: int = 3600, now=None) -> str:
    agora = int(now if now is not None else time.time())
    corpo = _b64(json.dumps({"sub": user_id, "role": role, "exp": agora + ttl}).encode())
    sig = _b64(hmac.new(secret.encode(), corpo.encode(), hashlib.sha256).digest())
    return f"{corpo}.{sig}"


def verify_access_token(secret: str, token: str, now=None) -> dict:
    try:
        corpo, sig = token.split(".")
    except ValueError:
        raise TokenError("formato inválido")
    esperado = _b64(hmac.new(secret.encode(), corpo.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, esperado):
        raise TokenError("assinatura inválida")
    dados = json.loads(base64.urlsafe_b64decode(corpo + "=" * (-len(corpo) % 4)))
    if dados["exp"] < int(now if now is not None else time.time()):
        raise TokenError("token expirado")
    return dados
