"""Authentication business logic."""

import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    TokenDecodeError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    SignupRequest,
    TokenResponse,
)

logger = logging.getLogger(__name__)

class AuthService:
    """Handles signup, login, and token refresh logic."""

    def __init__(self, db: AsyncSession) -> None:
        self._repository = UserRepository(db)

    async def signup(self, data: SignupRequest) -> TokenResponse:
        """Register a new user and return a token pair."""
        try:
            if await self._repository.email_exists(data.email):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered",
                )

            user = User(
                email=data.email,
                first_name=data.first_name,
                middle_name=data.middle_name,
                last_name=data.last_name,
                mobile_no=data.mobile_no,
                password=hash_password(data.password),
                role=UserRole.USER,
            )
            user = await self._repository.create(user)
            return self._generate_tokens(user)
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during signup", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not sign up user",
            )

    async def login(self, data: LoginRequest) -> TokenResponse:
        """Authenticate a user and return a token pair."""
        try:
            user = await self._repository.get_by_email(data.email)

            if not user or not verify_password(data.password, user.password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                )

            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account has been deactivated",
                )

            return self._generate_tokens(user)

        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise

        except Exception as e:
            logger.exception("Unexpected error during login: ", e)

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not log in user",
            )

    async def refresh(self, data: RefreshTokenRequest) -> TokenResponse:
        """Issue a new token pair from a valid refresh token."""
        try:
            payload = decode_token(
                data.refresh_token,
                expected_type=TokenType.REFRESH,
            )
        except TokenDecodeError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        try:
            user = await self._repository.get_by_id(int(user_id))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or deactivated",
            )

        return self._generate_tokens(user)

    @staticmethod
    def _generate_tokens(user: User) -> TokenResponse:
        """Build an access + refresh token pair for the given user ID."""
        return TokenResponse(
            access_token=create_access_token(subject=user.id, role=user.role),
            refresh_token=create_refresh_token(subject=user.id),
        )
