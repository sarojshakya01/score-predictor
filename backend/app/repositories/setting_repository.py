"""Repository for setting database operations."""

from collections.abc import Mapping

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import Setting


class SettingRepository:
    """Encapsulates all database operations for the Setting model."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, setting_id: int) -> Setting | None:
        """Fetch a setting by primary key."""
        result = await self._db.execute(
            select(Setting).where(Setting.id == setting_id),
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Setting | None:
        """Fetch a setting by unique name."""
        result = await self._db.execute(
            select(Setting).where(Setting.name == name),
        )
        return result.scalar_one_or_none()

    async def name_exists(
        self,
        name: str,
        *,
        exclude_setting_id: int | None = None,
    ) -> bool:
        """Check whether a setting name is already used."""
        statement = select(Setting.id).where(Setting.name == name)

        if exclude_setting_id is not None:
            statement = statement.where(Setting.id != exclude_setting_id)

        result = await self._db.execute(statement)
        return result.scalar_one_or_none() is not None

    async def list_settings(
        self,
        *,
        offset: int = 0,
        limit: int = 50,
        search: str | None = None,
    ) -> list[Setting]:
        """Fetch settings with optional search and pagination."""
        statement = select(Setting)

        if search is not None:
            statement = statement.where(Setting.name.ilike(f"%_{search}"))

        result = await self._db.execute(
            statement.order_by(Setting.name.asc(), Setting.id.asc())
            .offset(offset)
            .limit(limit),
        )
        return list(result.scalars().all())

    async def count_settings(self, *, search: str | None = None) -> int:
        """Count settings using the same filters as list_settings."""
        statement = select(func.count()).select_from(Setting)

        if search is not None:
            statement = statement.where(Setting.name.ilike(f"%_{search}"))

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def create(self, setting: Setting) -> Setting:
        """Persist a new setting and return the refreshed instance."""
        self._db.add(setting)
        await self._db.commit()
        await self._db.refresh(setting)
        return setting

    async def update(
        self,
        setting: Setting,
        values: Mapping[str, object],
    ) -> Setting:
        """Update an existing setting and return the refreshed instance."""
        for field_name, value in values.items():
            setattr(setting, field_name, value)

        await self._db.commit()
        await self._db.refresh(setting)
        return setting

    async def delete(self, setting: Setting) -> None:
        """Delete an existing setting."""
        await self._db.delete(setting)
        await self._db.commit()
