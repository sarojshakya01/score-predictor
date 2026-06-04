"""Authentication API routes.

Endpoints:
    POST /auth/signup   – Register a new user
    POST /auth/login    – Authenticate and receive tokens
    POST /auth/refresh  – Refresh an expired access token
    GET  /auth/me       – Get the current authenticated user
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.session import get_db
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
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def signup(
    data: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Create a new user account and return a JWT token pair."""
    service = AuthService(db)
    return await service.signup(data)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
async def login(
    data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Authenticate with credentials and return a JWT token pair."""
    service = AuthService(db)
    return await service.login(data)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
async def refresh(
    data: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Exchange a valid refresh token for a new token pair."""
    service = AuthService(db)
    return await service.refresh(data)


@router.post(
    "/verify-email",
    response_model=MessageResponse,
    summary="Verify account email",
)
async def verify_email(
    data: TokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Verify an account from an email verification token."""
    service = AuthService(db)
    return await service.verify_email(data)


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    summary="Resend account verification email",
)
async def resend_verification(
    data: EmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Send a fresh account verification link when needed."""
    service = AuthService(db)
    return await service.resend_verification(data)


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request a password reset email",
)
async def forgot_password(
    data: EmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Send a password reset link when the email belongs to an active account."""
    service = AuthService(db)
    return await service.forgot_password(data)


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password with token",
)
async def reset_password(
    data: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Reset a password using a valid one-time token."""
    service = AuthService(db)
    return await service.reset_password(data)


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change current user's password",
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Change the authenticated user's password."""
    service = AuthService(db)
    return await service.change_password(user=current_user, data=data)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def me(current_user: CurrentUser) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)
