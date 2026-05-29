"""Pydantic schemas for group standings responses."""

from pydantic import BaseModel, Field


class GroupStandingResponse(BaseModel):
    """Single team's group-stage standing."""

    team_id: int
    team: str
    fifa_code: str
    flag_url: str
    played: int = Field(..., ge=0)
    won: int = Field(..., ge=0)
    drawn: int = Field(..., ge=0)
    lost: int = Field(..., ge=0)
    goals_for: int = Field(..., ge=0)
    goals_against: int = Field(..., ge=0)
    goal_difference: int
    points: int = Field(..., ge=0)


class GroupTableResponse(BaseModel):
    """Group table with ordered standings."""

    group: str
    standings: list[GroupStandingResponse]


class GroupTableListResponse(BaseModel):
    """List response for all group tables."""

    items: list[GroupTableResponse]
    total: int
