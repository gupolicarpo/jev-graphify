"""Mapeamento de exceções de domínio para respostas HTTP."""
from auth.permissions import Forbidden
from auth.tokens import TokenError
from customers.credit import CreditLimitExceeded
from payments.pix import InvalidSignature

HTTP_STATUS = {
    Forbidden: 403,
    TokenError: 401,
    CreditLimitExceeded: 422,
    InvalidSignature: 400,
    ValueError: 400,
}


def error_to_response(exc: Exception) -> tuple:
    for tipo, status in HTTP_STATUS.items():
        if isinstance(exc, tipo):
            return {"erro": str(exc)}, status
    return {"erro": "erro interno"}, 500
