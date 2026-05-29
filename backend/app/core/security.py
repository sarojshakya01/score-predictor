"""Password hashing and JWT token utilities."""

import enum
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from passlib.context import CryptContext

from app.core.config import settings
from app.models.user import UserRole

# ── Password Hashing ────────────────────────────────────────────

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return _pwd_context.verify(plain_password, hashed_password)


# ── JWT Tokens ──────────────────────────────────────────────────


class TokenType(str, enum.Enum):
    """Supported JWT token types."""

    ACCESS = "access"
    REFRESH = "refresh"


class TokenDecodeError(ValueError):
    """Raised when a JWT cannot be decoded or validated."""


class TokenExpiredError(TokenDecodeError):
    """Raised when a JWT has expired."""


def _create_token(
    *,
    subject: int | str,
    token_type: TokenType,
    expires_delta: timedelta,
    role: UserRole | None = None,
) -> str:
    """Create a signed JWT token."""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": now + expires_delta,
        "iat": now,
        "jti": uuid.uuid4().hex,
        "type": token_type.value,
    }

    if role is not None:
        payload["role"] = role.value

    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def create_access_token(subject: int | str, role: UserRole | None = None) -> str:
    """Create a short-lived access token."""
    return _create_token(
        subject=subject,
        token_type=TokenType.ACCESS,
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES),
        role=role,
    )


def create_refresh_token(subject: int | str) -> str:
    """Create a long-lived refresh token."""
    return _create_token(
        subject=subject,
        token_type=TokenType.REFRESH,
        expires_delta=timedelta(minutes=settings.JWT_REFRESH_EXPIRE_MINUTES),
    )


def decode_token(
    token: str,
    *,
    expected_type: TokenType | None = None,
) -> dict[str, Any]:
    """Decode and validate a JWT token.

    Raises:
        TokenExpiredError: If the token has expired.
        TokenDecodeError: If the token is malformed or invalid.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError as exc:
        raise TokenExpiredError("Token has expired") from exc
    except InvalidTokenError as exc:
        raise TokenDecodeError("Token is invalid") from exc

    if not isinstance(payload.get("sub"), str):
        raise TokenDecodeError("Token subject is invalid")

    payload_token_type = payload.get("type")
    if expected_type is not None and payload_token_type != expected_type.value:
        raise TokenDecodeError("Token type is invalid")

    valid_token_types = {token_type.value for token_type in TokenType}
    if payload_token_type not in valid_token_types:
        raise TokenDecodeError("Token type is invalid")

    return payload
