"""Setting business logic."""

import logging

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import Setting
from app.repositories.setting_repository import SettingRepository
from app.schemas.setting import (
    SettingCreate,
    SettingListResponse,
    SettingResponse,
    SettingUpdate,
)

logger = logging.getLogger(__name__)

class SettingService:
    """Handles setting validation and orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self._setting_repository = SettingRepository(db)

    async def list_settings(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None = None,
    ) -> SettingListResponse:
        """Return paginated settings for admin management."""
        try:
            settings = await self._setting_repository.list_settings(
                offset=offset,
                limit=limit,
                search=search,
            )
            total = await self._setting_repository.count_settings(search=search)
            return self._build_list_response(
                settings=settings,
                total=total,
                limit=limit,
                offset=offset,
            )
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during list_settings", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not list settings",
            )

    async def create_setting(self, data: SettingCreate) -> SettingResponse:
        """Create a setting after validating uniqueness."""
        if await self._setting_repository.name_exists(data.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Setting name already exists",
            )

        setting = Setting(**data.model_dump())
        try:
            created_setting = await self._setting_repository.create(setting)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Setting name already exists",
            )

        return SettingResponse.model_validate(created_setting)

    async def update_setting(
        self,
        *,
        setting_id: int,
        data: SettingUpdate,
    ) -> SettingResponse:
        """Update a setting after validating uniqueness."""
        setting = await self._get_setting_or_404(setting_id)
        values = data.model_dump(exclude_unset=True)

        if not values:
            return SettingResponse.model_validate(setting)

        new_name = values.get("name")
        if isinstance(new_name, str) and await self._setting_repository.name_exists(
            new_name,
            exclude_setting_id=setting_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Setting name already exists",
            )

        try:
            updated_setting = await self._setting_repository.update(setting, values)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Setting name already exists",
            )

        return SettingResponse.model_validate(updated_setting)

    async def delete_setting(self, setting_id: int) -> None:
        """Delete an existing setting."""
        setting = await self._get_setting_or_404(setting_id)
        await self._setting_repository.delete(setting)

    async def _get_setting_or_404(self, setting_id: int) -> Setting:
        """Fetch a setting or raise a 404."""
        setting = await self._setting_repository.get_by_id(setting_id)
        if setting is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Setting not found",
            )
        return setting

    @staticmethod
    def _build_list_response(
        *,
        settings: list[Setting],
        total: int,
        limit: int,
        offset: int,
    ) -> SettingListResponse:
        """Build a paginated setting response."""
        return SettingListResponse(
            items=[
                SettingResponse.model_validate(setting)
                for setting in settings
            ],
            total=total,
            limit=limit,
            offset=offset,
        )
