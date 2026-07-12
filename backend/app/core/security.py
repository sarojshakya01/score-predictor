"""Password hashing, random token, and JWT token utilities."""

import enum
import hashlib
import hmac
import secrets
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


# ── One-time URL Tokens ───────────────────────────────────────────


def create_url_safe_token() -> str:
    """Create a URL-safe random token for email links."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash a one-time token before storing or looking it up."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_password_fingerprint(password_hash: str) -> str:
    """Create a server-secret fingerprint for token invalidation."""
    return hmac.new(
        settings.JWT_SECRET.encode("utf-8"),
        password_hash.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def token_password_fingerprint_matches(
    payload: dict[str, Any],
    password_hash: str,
) -> bool:
    """Return whether a JWT still matches the user's current password hash."""
    token_fingerprint = payload.get("pwd")
    if not isinstance(token_fingerprint, str):
        return False

    return hmac.compare_digest(
        token_fingerprint,
        create_password_fingerprint(password_hash),
    )


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
    password_hash: str | None = None,
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

    if password_hash is not None:
        payload["pwd"] = create_password_fingerprint(password_hash)

    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def create_access_token(
    subject: int | str,
    role: UserRole | None = None,
    password_hash: str | None = None,
) -> str:
    """Create a short-lived access token."""
    return _create_token(
        subject=subject,
        token_type=TokenType.ACCESS,
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES),
        role=role,
        password_hash=password_hash,
    )


def create_refresh_token(
    subject: int | str,
    password_hash: str | None = None,
) -> str:
    """Create a long-lived refresh token."""
    return _create_token(
        subject=subject,
        token_type=TokenType.REFRESH,
        expires_delta=timedelta(minutes=settings.JWT_REFRESH_EXPIRE_MINUTES),
        password_hash=password_hash,
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
