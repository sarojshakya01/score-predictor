"""Pydantic schemas for match requests and responses."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.match import FirstGoalIn, MatchDuration, MatchStage


class MatchBase(BaseModel):
    """Shared match fields."""

    team1_id: int = Field(..., gt=0)
    team2_id: int = Field(..., gt=0)
    team1_score: int | None = Field(default=None, ge=0)
    team2_score: int | None = Field(default=None, ge=0)
    yellow_card_count: int | None = Field(default=None, ge=0)
    red_card_count: int | None = Field(default=None, ge=0)
    kick_off_team_id: int | None = Field(default=None, gt=0)
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    first_goal_in: FirstGoalIn | None = None
    match_duration: MatchDuration | None = None
    match_stage: MatchStage | None = None
    match_datetime: datetime
    match_locked: bool = False
    match_reminder_sent: bool = False
    match_day: int = Field(..., gt=0)
    venue_name: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_match_teams(self) -> "MatchBase":
        """Validate team relationships within the match payload."""
        if self.team1_id == self.team2_id:
            raise ValueError("team1_id and team2_id must be different")

        if self.kick_off_team_id is not None and self.kick_off_team_id not in {
            self.team1_id,
            self.team2_id,
        }:
            raise ValueError("kick_off_team_id must match one of the match teams")

        if (
            self.first_scoring_team_id is not None
            and self.first_scoring_team_id not in {self.team1_id, self.team2_id}
        ):
            raise ValueError("first_scoring_team_id must match one of the match teams")

        return self


class MatchCreate(MatchBase):
    """Schema for creating a match."""


class MatchUpdate(BaseModel):
    """Schema for updating a match."""

    team1_id: int | None = Field(default=None, gt=0)
    team2_id: int | None = Field(default=None, gt=0)
    team1_score: int | None = Field(default=None, ge=0)
    team2_score: int | None = Field(default=None, ge=0)
    yellow_card_count: int | None = Field(default=None, ge=0)
    red_card_count: int | None = Field(default=None, ge=0)
    kick_off_team_id: int | None = Field(default=None, gt=0)
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    first_goal_in: FirstGoalIn | None = None
    match_duration: MatchDuration | None = None
    match_stage: MatchStage | None = None
    match_datetime: datetime | None = None
    match_locked: bool | None = None
    match_reminder_sent: bool | None = None
    match_day: int | None = Field(default=None, gt=0)
    venue_name: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_match_teams(self) -> "MatchUpdate":
        """Validate team relationships when enough update fields are present."""
        if (
            self.team1_id is not None
            and self.team2_id is not None
            and self.team1_id == self.team2_id
        ):
            raise ValueError("team1_id and team2_id must be different")

        if (
            self.team1_id is not None
            and self.team2_id is not None
            and self.kick_off_team_id is not None
            and self.kick_off_team_id not in {self.team1_id, self.team2_id}
        ):
            raise ValueError("kick_off_team_id must match one of the match teams")

        if (
            self.team1_id is not None
            and self.team2_id is not None
            and self.first_scoring_team_id is not None
            and self.first_scoring_team_id not in {self.team1_id, self.team2_id}
        ):
            raise ValueError("first_scoring_team_id must match one of the match teams")

        return self


class MatchResponse(MatchBase):
    """Public match representation returned by API endpoints."""

    id: int
    created_at: datetime
    updated_at: datetime
    team1_name: str
    team1_name_short: str
    team1_group: str
    team1_flag_url: str
    team2_name: str
    team2_name_short: str
    team2_group: str
    team2_flag_url: str

    model_config = ConfigDict(from_attributes=True)


class MatchListResponse(BaseModel):
    """Paginated match list response."""

    items: list[MatchResponse]
    total: int
    limit: int
    offset: int
