"""Pydantic schemas for home-page summary responses."""

from datetime import datetime

from pydantic import BaseModel, Field


class HomeNextLockResponse(BaseModel):
    """Next prediction lock shown on the home page."""

    match_id: int
    label: str
    lock_datetime: datetime
    minutes_until_lock: int = Field(..., ge=0)


class HomeSummaryResponse(BaseModel):
    """Home-page tournament summary stats."""

    open_matches: int = Field(..., ge=0)
    predictions_made: int = Field(..., ge=0)
    locking_soon: int = Field(..., ge=0)
    completed_matches: int = Field(..., ge=0)
    next_lock: HomeNextLockResponse | None
