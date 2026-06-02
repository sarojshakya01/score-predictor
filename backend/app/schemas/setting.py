"""Pydantic schemas for setting requests and responses."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SettingBase(BaseModel):
    """Shared setting fields."""

    name: str = Field(..., min_length=1, max_length=100)
    friendly_name: str = Field(..., min_length=1, max_length=100)
    value: dict[str, Any] = Field(...)

    @field_validator("name", "friendly_name")
    @classmethod
    def strip_text(cls, v: str) -> str:
        """Normalize setting text fields."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("value must not be empty")
        return stripped

    @field_validator("value")
    @classmethod
    def value_not_empty(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Ensure value dict is not empty."""
        if not v:
            raise ValueError("value must not be an empty object")
        return v


class SettingCreate(SettingBase):
    """Schema for creating a setting."""


class SettingUpdate(BaseModel):
    """Schema for updating a setting (all fields optional)."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    friendly_name: str | None = Field(default=None, min_length=1, max_length=100)
    value: dict[str, Any] | None = None

    @field_validator("name", "friendly_name")
    @classmethod
    def strip_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("value must not be empty")
        return stripped

    @field_validator("value")
    @classmethod
    def value_not_empty(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is not None and not v:
            raise ValueError("value must not be an empty object")
        return v


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


# ── Specialised read responses ────────────────────────────────────────────────

class MatchDayResponse(BaseModel):
    """Current match day response."""

    value: int


class GameRuleEntry(BaseModel):
    """A single scoring line within a rule group."""

    order: int
    points: int
    instruction: str


class GameRuleGroup(BaseModel):
    """A named category of scoring rules (e.g. score, yellow_card)."""

    name: str
    friend_name: str
    order: int
    rules: list[GameRuleEntry]


class GameRulesResponse(BaseModel):
    """Parsed game_rules setting response."""

    rules: list[GameRuleGroup]
