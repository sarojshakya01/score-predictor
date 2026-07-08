"""User API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdminUser, CurrentUser
from app.db.session import get_db
from app.models.user import UserRole
from app.schemas.leaderboard import (
    FinalistPredictionsResponse,
    LeaderboardResponse,
    MatchPointsDetailsResponse,
)
from app.schemas.prediction import UserPointsDetailsListResponse
from app.schemas.user import (
    UserCreate,
    UserListResponse,
    UserProfileUpdate,
    UserResponse,
    UserUpdate,
)
from app.services.leaderboard_service import LeaderboardService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])
leaderboard_router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])
admin_router = APIRouter(prefix="/admin/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_current_user_profile(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Return the current authenticated user's profile."""
    service = UserService(db)
    return await service.get_current_profile(current_user)


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile",
)
async def update_current_user_profile(
    data: UserProfileUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update the current authenticated user's profile."""
    service = UserService(db)
    return await service.update_current_profile(user=current_user, data=data)

@router.put(
    "/finalist",
    response_model=UserResponse,
    summary="Update current user's finalist",
)
async def update_current_user_finalist(
    data: UserProfileUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update the current authenticated user's profile."""
    service = UserService(db)
    return await service.update_current_profile(user=current_user, data=data)


@leaderboard_router.get(
    "",
    response_model=LeaderboardResponse,
    summary="Get leaderboard",
)
async def get_leaderboard(
    _current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=10000)] = 1000,
    is_race_data_required: Annotated[bool | None, Query()] = None,
) -> LeaderboardResponse:
    """Return leaderboard standings for authenticated users."""
    service = LeaderboardService(db)
    return await service.get_leaderboard(offset=offset, limit=limit, is_race_data_required=is_race_data_required)


@leaderboard_router.get(
    "/users/{user_id}/points-details",
    response_model=UserPointsDetailsListResponse,
    summary="Get user points details",
)
async def get_user_points_details(
    user_id: Annotated[int, Path(gt=0)],
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserPointsDetailsListResponse:
    """Return scored prediction details for a specific user across completed matches."""
    service = LeaderboardService(db)
    return await service.get_user_points_details(current_user=current_user, user_id=user_id)


@leaderboard_router.get(
    "/finalist-predictions",
    response_model=FinalistPredictionsResponse,
    summary="Get finalist predictions",
)
async def get_finalist_predictions(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FinalistPredictionsResponse:
    """Return all users' finalist predictions in leaderboard order."""
    service = LeaderboardService(db)
    return await service.get_finalist_predictions(current_user=current_user)


@leaderboard_router.get(
    "/matches/{match_id}/points-details",
    response_model=MatchPointsDetailsResponse,
    summary="Get match points details",
)
async def get_match_points_details(
    match_id: Annotated[int, Path(gt=0)],
    _current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MatchPointsDetailsResponse:
    """Return scored prediction details for every active user on a completed match."""
    service = LeaderboardService(db)
    return await service.get_match_points_details(match_id=match_id)


@admin_router.get(
    "",
    response_model=UserListResponse,
    summary="List users",
)
async def list_users(
    _current_admin: CurrentAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: Annotated[str | None, Query(min_length=1, max_length=255)] = None,
) -> UserListResponse:
    """Return paginated users for admin management."""
    service = UserService(db)
    return await service.list_users(
        offset=offset,
        limit=limit,
        role=role,
        is_active=is_active,
        search=search,
    )


@admin_router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user",
)
async def get_user(
    user_id: Annotated[int, Path(gt=0)],
    _current_admin: CurrentAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Return a single user from the admin user management screen."""
    service = UserService(db)
    return await service.get_user(user_id)


@admin_router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create user",
)
async def create_user(
    data: UserCreate,
    _current_admin: CurrentAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Create a user from the admin user management screen."""
    service = UserService(db)
    return await service.create_user(data)


@admin_router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user",
)
async def update_user(
    user_id: Annotated[int, Path(gt=0)],
    data: UserUpdate,
    current_admin: CurrentAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update a user from the admin user management screen."""
    service = UserService(db)
    return await service.update_user(
        user_id=user_id,
        current_admin_id=current_admin.id,
        data=data,
    )


@admin_router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user",
)
async def delete_user(
    user_id: Annotated[int, Path(gt=0)],
    current_admin: CurrentAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Delete a user from the admin user management screen."""
    service = UserService(db)
    await service.delete_user(user_id=user_id, current_admin_id=current_admin.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
