"""Setting API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.session import get_db
from app.schemas.setting import (
    GameRulesResponse,
    MatchDayResponse,
    SettingCreate,
    SettingListResponse,
    SettingResponse,
    SettingUpdate,
)
from app.services.setting_service import SettingService

router = APIRouter(prefix="", tags=["Rules", "Matches"])

admin_router = APIRouter(
    prefix="/admin/settings",
    tags=["Settings"],
    dependencies=[Depends(get_current_admin_user)],
)


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get(
    "/matchday",
    response_model=MatchDayResponse,
    summary="Current match day",
)
async def get_current_match_day(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MatchDayResponse:
    """Return the current match day number."""
    service = SettingService(db)
    return await service.get_current_match_day()


@router.get(
    "/rules",
    response_model=GameRulesResponse,
    summary="Game scoring rules",
)
async def get_game_rules(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameRulesResponse:
    """Return the list of scoring rules for the rules page."""
    service = SettingService(db)
    return await service.get_game_rules()


# ── Admin endpoints ───────────────────────────────────────────────────────────

@admin_router.get(
    "",
    response_model=SettingListResponse,
    summary="List settings",
)
async def list_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
) -> SettingListResponse:
    """Return paginated settings for admin management."""
    service = SettingService(db)
    return await service.list_settings(offset=offset, limit=limit, search=search)


@admin_router.get(
    "/{setting_id}",
    response_model=SettingResponse,
    summary="Get setting",
)
async def get_setting(
    setting_id: Annotated[int, Path(gt=0)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SettingResponse:
    """Return a single setting by id."""
    service = SettingService(db)
    return await service.get_setting(setting_id)


@admin_router.post(
    "",
    response_model=SettingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create setting",
)
async def create_setting(
    data: SettingCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SettingResponse:
    """Create a setting."""
    service = SettingService(db)
    return await service.create_setting(data)


@admin_router.put(
    "/{setting_id}",
    response_model=SettingResponse,
    summary="Update setting",
)
async def update_setting(
    setting_id: Annotated[int, Path(gt=0)],
    data: SettingUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SettingResponse:
    """Update a setting."""
    service = SettingService(db)
    return await service.update_setting(setting_id=setting_id, data=data)


@admin_router.delete(
    "/{setting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete setting",
)
async def delete_setting(
    setting_id: Annotated[int, Path(gt=0)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Delete a setting."""
    service = SettingService(db)
    await service.delete_setting(setting_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
