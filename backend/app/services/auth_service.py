"""Authentication business logic."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    TokenDecodeError,
    TokenType,
    create_access_token,
    create_refresh_token,
    create_url_safe_token,
    decode_token,
    hash_password,
    hash_token,
    token_password_fingerprint_matches,
    verify_password,
)
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    EmailRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenRequest,
    TokenResponse,
)
from app.services.email_service import (
    send_account_verification_email,
    send_password_reset_email,
)

logger = logging.getLogger(__name__)


def _now() -> datetime:
    """Return the current UTC time."""
    return datetime.now(timezone.utc)


def _is_expired(value: datetime | None) -> bool:
    """Return true when a stored expiry is missing or in the past."""
    if value is None:
        return True

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value <= _now()


class AuthService:
    """Handles signup, login, and token refresh logic."""

    def __init__(self, db: AsyncSession) -> None:
        self._repository = UserRepository(db)

    async def signup(self, data: SignupRequest) -> TokenResponse:
        """Register a new user and email an account verification link."""
        try:
            if await self._repository.email_exists(data.email):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered",
                )

            verification_token = create_url_safe_token()
            user = User(
                email=data.email,
                first_name=data.first_name,
                middle_name=data.middle_name,
                last_name=data.last_name,
                mobile_no=data.mobile_no,
                password=hash_password(data.password),
                role=UserRole.USER,
                is_active=False,
                email_verified_at=None,
                email_verification_token_hash=hash_token(verification_token),
                email_verification_expires_at=(
                    _now()
                    + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)
                ),
            )
            user = await self._repository.create(user)

            admin_users = await self._repository.list_users(
                offset=0,
                limit=50,
                role=UserRole.ADMIN,
                is_active=True,
                search=None)
            admin_emails = [admin_user.email for admin_user in admin_users]

            self._queue_account_verification_email(user, admin_emails, verification_token)

            return TokenResponse(
                access_token="",
                refresh_token="",
                message=(
                    "Account created successfully. Please check your email (" 
                    + data.email 
                    + ") to verify your account."
                ),
            )
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
                detail = (
                    "Please verify your email before logging in."
                    if user.email_verified_at is None
                    else "Account is not active. Please contact admin to activate/renew your account."
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=detail,
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

        if not token_password_fingerprint_matches(payload, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session is no longer valid",
            )

        return self._generate_tokens(user)

    async def verify_email(self, data: TokenRequest) -> MessageResponse:
        """Verify a user's email address from a one-time email token."""
        user = await self._repository.get_by_email_verification_token_hash(
            hash_token(data.token),
        )
        if user is None or _is_expired(user.email_verification_expires_at):
            if user is not None:
                await self._repository.update(
                    user,
                    {
                        "email_verification_token_hash": None,
                        "email_verification_expires_at": None,
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification link is invalid or expired.",
            )

        updated_user = await self._repository.update(
            user,
            {
                "email_verified_at": _now(),
                "email_verification_token_hash": None,
                "email_verification_expires_at": None,
                "is_active": False,
            },
        )
        logger.info("Verified account for user %s", updated_user.id)
        return MessageResponse(message="Email verified successfully. You can now log in after activation by admin.")

    async def resend_verification(self, data: EmailRequest) -> MessageResponse:
        """Send a fresh email verification link when an account is unverified."""
        user = await self._repository.get_by_email(data.email)
        message = (
            "If this account needs verification, a new verification email has "
            "been sent."
        )

        if user is None or user.email_verified_at is not None:
            return MessageResponse(message=message)

        verification_token = create_url_safe_token()
        updated_user = await self._repository.update(
            user,
            {
                "email_verification_token_hash": hash_token(verification_token),
                "email_verification_expires_at": (
                    _now()
                    + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)
                ),
            },
        )
        admin_users = self._repository.list_users(
            offset=0,
            limit=50,
            role=UserRole.ADMIN,
            is_active=True,
            search=None)
        admin_emails = [admin_user.email for admin_user in admin_users]

        self._queue_account_verification_email(updated_user, admin_emails, verification_token)
        return MessageResponse(message=message)

    async def forgot_password(self, data: EmailRequest) -> MessageResponse:
        """Email a password reset link if the account exists and is usable."""
        user = await self._repository.get_by_email(data.email)
        message = (
            "Password reset link has been sent to your email."
        )

        if user is None or not user.is_active:
            return MessageResponse(message=message)

        reset_token = create_url_safe_token()
        updated_user = await self._repository.update(
            user,
            {
                "password_reset_token_hash": hash_token(reset_token),
                "password_reset_expires_at": (
                    _now()
                    + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
                ),
            },
        )
        self._queue_password_reset_email(updated_user, reset_token)
        return MessageResponse(message=message)

    async def reset_password(self, data: ResetPasswordRequest) -> MessageResponse:
        """Set a new password using a valid password reset token."""
        user = await self._repository.get_by_password_reset_token_hash(
            hash_token(data.token),
        )
        if user is None or _is_expired(user.password_reset_expires_at):
            if user is not None:
                await self._repository.update(
                    user,
                    {
                        "password_reset_token_hash": None,
                        "password_reset_expires_at": None,
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset link is invalid or expired.",
            )

        await self._repository.update(
            user,
            {
                "password": hash_password(data.password),
                "password_reset_token_hash": None,
                "password_reset_expires_at": None,
            },
        )
        return MessageResponse(message="Password updated successfully. You can now log with new password.")

    async def change_password(
        self,
        *,
        user: User,
        data: ChangePasswordRequest,
    ) -> MessageResponse:
        """Change the password for the current authenticated user."""
        if not verify_password(data.current_password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )

        if verify_password(data.new_password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from the current password.",
            )

        await self._repository.update(
            user,
            {
                "password": hash_password(data.new_password),
                "password_reset_token_hash": None,
                "password_reset_expires_at": None,
            },
        )
        return MessageResponse(message="Password changed successfully.")

    @staticmethod
    def _generate_tokens(user: User) -> TokenResponse:
        """Build an access + refresh token pair for the given user ID."""
        message = "User created and logged in successfully." if user.is_active else "User created successfully. Please contact admin for activation."

        return TokenResponse(
            access_token=create_access_token(
                subject=user.id,
                role=user.role,
                password_hash=user.password,
            ),
            refresh_token=create_refresh_token(
                subject=user.id,
                password_hash=user.password,
            ),
            message=message
        )

    @staticmethod
    def _build_site_link(path: str, token: str) -> str:
        """Build an absolute frontend URL for an email token action."""
        base_url = settings.SITE_URL.rstrip("/")
        return f"{base_url}/{path.lstrip('/')}?{urlencode({'token': token})}"

    def _queue_account_verification_email(self, user: User, admin_emails: list[str], token: str) -> None:
        """Send account verification email in the background."""
        verification_url = self._build_site_link("/verify-email", token)
        try:
            asyncio.create_task(
                send_account_verification_email(
                    email=user.email,
                    first_name=user.first_name,
                    verification_url=verification_url,
                    admin_emails=admin_emails
                ),
            )
        except Exception:
            logger.exception("Failed to queue verification email for user %s", user.id)

    def _queue_password_reset_email(self, user: User, token: str) -> None:
        """Send password reset email in the background."""
        reset_url = self._build_site_link("/reset-password", token)
        try:
            asyncio.create_task(
                send_password_reset_email(
                    email=user.email,
                    first_name=user.first_name,
                    reset_url=reset_url,
                    admin_emails=[]
                ),
            )
        except Exception:
            logger.exception("Failed to queue password reset email for user %s", user.id)
