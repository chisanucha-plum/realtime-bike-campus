from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from fastapi import Response
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt

from app.configuration import Configuration
from app.core.exceptions import TokenDecodeError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="user/login")

config = Configuration.get_config()

REFRESH_DAYS = 30


def set_refresh_cookie(response: Response, token: str) -> None:
    """Set secure refresh token cookie with consistent settings."""
    cookie = config.refresh_token_cookie
    response.set_cookie(
        key=cookie.cookie_name,
        value=token,
        max_age=cookie.max_age,
        httponly=cookie.httponly,
        secure=cookie.secure,
        samesite=cookie.samesite,
        path=cookie.path,
        domain=cookie.domain,
    )


def clear_refresh_cookie(response: Response) -> None:
    """Delete the refresh token cookie and the legacy-named one if different."""
    cookie = config.refresh_token_cookie
    common = dict(
        httponly=cookie.httponly,
        secure=cookie.secure,
        samesite=cookie.samesite,
        path=cookie.path,
        domain=cookie.domain,
    )
    response.delete_cookie(key=cookie.cookie_name, **common)
    if cookie.legacy_cookie_name != cookie.cookie_name:
        response.delete_cookie(key=cookie.legacy_cookie_name, **common)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against its hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(password: str) -> str:
    """Generate password hash."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _decode_jwt(token: str, token_type: str | None = None) -> dict[str, Any]:
    """Decode and verify JWT token with consistent error handling."""
    try:
        payload = jwt.decode(
            token, config.key.secret_key, algorithms=[config.key.algorithm]
        )
    except ExpiredSignatureError as e:
        raise TokenDecodeError("Token has expired.") from e
    except JWTError as e:
        raise TokenDecodeError(f"Invalid token: {e}") from e
    except Exception as e:
        raise TokenDecodeError(f"Unexpected error during token decoding: {e}") from e

    if token_type and payload.get("type") != token_type:
        raise TokenDecodeError(f"Wrong token type. Expected {token_type}.")

    return payload


def create_access_token(
    data: dict[str, Any], expires_delta: timedelta | None = None
) -> str:
    """Create JWT access token."""
    claims = data.copy()
    delta = expires_delta or timedelta(minutes=config.key.access_token_minutes)
    now = datetime.now(timezone.utc)
    claims.update({"exp": now + delta, "iat": now, "type": "access"})
    return jwt.encode(claims, config.key.secret_key, algorithm=config.key.algorithm)


def decode_token(token: str) -> str:
    """Decode and verify JWT access token and return its subject ('sub')."""
    payload = _decode_jwt(token, token_type="access")
    sub = payload.get("sub")
    if sub is None:
        raise TokenDecodeError("Token payload missing 'sub' claim.")
    return sub


def create_refresh_token(data: dict[str, Any]) -> str:
    """Create JWT refresh token with longer expiry."""
    claims = data.copy()
    now = datetime.now(timezone.utc)
    claims.update(
        {
            "exp": now + timedelta(days=REFRESH_DAYS),
            "iat": now,
            "type": "refresh",
        }
    )
    return jwt.encode(claims, config.key.secret_key, algorithm=config.key.algorithm)


def verify_refresh_token(token: str) -> dict[str, Any]:
    """Decode and verify JWT refresh token."""
    return _decode_jwt(token, token_type="refresh")
