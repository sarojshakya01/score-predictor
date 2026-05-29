"""Setting API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.session import get_db
from app.schemas.setting import (
    SettingCreate,
    SettingListResponse,
    SettingResponse,
    SettingUpdate,
)
from app.services.setting_service import SettingService

router = APIRouter(
    prefix="/admin/settings",
    tags=["Admin Settings"],
    dependencies=[Depends(get_current_admin_user)],
)


@router.get(
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
    return await service.list_settings(
        offset=offset,
        limit=limit,
        search=search,
    )


@router.post(
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


@router.put(
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


@router.delete(
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
