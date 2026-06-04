"""Shared FastAPI dependencies for authentication and authorization."""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    TokenDecodeError,
    TokenExpiredError,
    TokenType,
    decode_token,
)
from app.db.session import get_db
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository

_security_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    """Build a standard bearer-token authentication error."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_security_scheme)
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and validate the current user from the Bearer token."""
    if credentials is None:
        raise _unauthorized("Authentication required")

    try:
        payload = decode_token(
            credentials.credentials,
            expected_type=TokenType.ACCESS,
        )
    except TokenExpiredError:
        raise _unauthorized("Access token has expired")
    except TokenDecodeError:
        raise _unauthorized("Invalid access token")

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise _unauthorized("Invalid token payload")

    repository = UserRepository(db)
    try:
        user = await repository.get_by_id(int(user_id))
    except ValueError:
        raise _unauthorized("Invalid token payload")

    if not user:
        raise _unauthorized("User not found")

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been not active. Please contact admin to renew your account.",
        )

    return user


def require_roles(*allowed_roles: UserRole) -> Callable[..., Awaitable[User]]:
    """Create a dependency that requires one of the supplied roles."""
    if not allowed_roles:
        raise ValueError("At least one role is required")

    async def role_dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_dependency


async def get_current_admin_user(
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
) -> User:
    """Ensure the current user has the ADMIN role."""
    return current_user


# ── Reusable type aliases for route signatures ──────────────────

CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentAdminUser = Annotated[User, Depends(get_current_admin_user)]
