"""Pydantic schemas for setting requests and responses."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SettingBase(BaseModel):
    """Shared setting fields."""

    name: str = Field(..., min_length=1, max_length=100)
    value: str = Field(..., min_length=1)

    @field_validator("name", "value")
    @classmethod
    def strip_text(cls, value: str) -> str:
        """Normalize setting text fields."""
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("value must not be empty")
        return stripped_value


class SettingCreate(SettingBase):
    """Schema for creating a setting."""


class SettingUpdate(BaseModel):
    """Schema for updating a setting."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    value: str | None = Field(default=None, min_length=1)

    @field_validator("name", "value")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        """Normalize setting text fields when provided."""
        if value is None:
            return None

        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("value must not be empty")
        return stripped_value


class SettingResponse(SettingBase):
    """Public setting representation returned by API endpoints."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SettingListResponse(BaseModel):
    """Paginated setting list response."""

    items: list[SettingResponse]
    total: int
    limit: int
    offset: int
