"""Pydantic schemas for team requests and responses."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TeamBase(BaseModel):
    """Shared team fields."""

    name: str = Field(..., min_length=1, max_length=100)
    group: str = Field(..., min_length=1, max_length=20)
    fifa_code: str = Field(..., min_length=2, max_length=3)

    @field_validator("name", "group")
    @classmethod
    def strip_text(cls, value: str) -> str:
        """Normalize text fields."""
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("value must not be empty")
        return stripped_value

    @field_validator("fifa_code")
    @classmethod
    def normalize_fifa_code(cls, value: str) -> str:
        """Normalize country codes for consistent storage."""
        normalized_value = value.strip().upper()
        if len(normalized_value) not in {2, 3}:
            raise ValueError("fifa_code must be 2 or 3 characters")
        return normalized_value


class TeamCreate(TeamBase):
    """Schema for creating a team."""


class TeamUpdate(BaseModel):
    """Schema for updating a team."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    group: str | None = Field(default=None, min_length=1, max_length=20)
    fifa_code: str | None = Field(default=None, min_length=2, max_length=3)

    @field_validator("name", "group")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        """Normalize text fields when provided."""
        if value is None:
            return None
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("value must not be empty")
        return stripped_value

    @field_validator("fifa_code")
    @classmethod
    def normalize_fifa_code(cls, value: str | None) -> str | None:
        """Normalize country codes when provided."""
        if value is None:
            return None
        normalized_value = value.strip().upper()
        if len(normalized_value) not in {2, 3}:
            raise ValueError("fifa_code must be 2 or 3 characters")
        return normalized_value


class TeamResponse(TeamBase):
    """Public team representation returned by API endpoints."""

    id: int
    created_at: datetime
    updated_at: datetime

    flag_url: str

    model_config = ConfigDict(from_attributes=True)


class TeamListResponse(BaseModel):
    """Paginated team list response."""

    items: list[TeamResponse]
    total: int
    limit: int
    offset: int
