"""Papéis e checagem de permissão."""
from functools import wraps

ROLE_ORDER = {"viewer": 1, "operator": 2, "finance": 3, "admin": 4}


class Forbidden(Exception):
    pass


def require_role(minimum: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(claims: dict, *args, **kwargs):
            if ROLE_ORDER.get(claims.get("role"), 0) < ROLE_ORDER[minimum]:
                raise Forbidden(f"exige papel {minimum}")
            return fn(claims, *args, **kwargs)
        return wrapper
    return decorator
