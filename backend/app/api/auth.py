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
    LoginRequest,
    RefreshTokenRequest,
    SignupRequest,
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


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def me(current_user: CurrentUser) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)
