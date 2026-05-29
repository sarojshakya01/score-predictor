"""Pydantic schemas for prediction requests and responses."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.match import GameDuration


class PredictionFields(BaseModel):
    """Shared prediction fields supplied by users."""

    team1_score: int = Field(..., ge=0)
    team2_score: int = Field(..., ge=0)
    yellow_card_count: int = Field(..., ge=0)
    red_card_count: int = Field(..., ge=0)
    opening_team_id: int = Field(..., gt=0)
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    is_goal_in_first_half: bool | None = None
    game_duration: GameDuration

    @model_validator(mode="after")
    def validate_goal_timeline_fields(self) -> "PredictionFields":
        """Require first-goal details only when goals are predicted."""
        has_predicted_goal = self.team1_score + self.team2_score > 0

        if has_predicted_goal and self.first_scoring_team_id is None:
            raise ValueError("first_scoring_team_id is required when goals are predicted")

        if has_predicted_goal and self.is_goal_in_first_half is None:
            raise ValueError("is_goal_in_first_half is required when goals are predicted")

        if not has_predicted_goal and self.first_scoring_team_id is not None:
            raise ValueError("first_scoring_team_id is only allowed when goals are predicted")

        if not has_predicted_goal and self.is_goal_in_first_half is not None:
            raise ValueError("is_goal_in_first_half is only allowed when goals are predicted")

        return self


class PredictionCreate(PredictionFields):
    """Schema for creating a prediction for the current user."""

    match_id: int = Field(..., gt=0)


class PredictionUpdate(BaseModel):
    """Schema for updating an existing prediction."""

    team1_score: int | None = Field(default=None, ge=0)
    team2_score: int | None = Field(default=None, ge=0)
    yellow_card_count: int | None = Field(default=None, ge=0)
    red_card_count: int | None = Field(default=None, ge=0)
    opening_team_id: int | None = Field(default=None, gt=0)
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    is_goal_in_first_half: bool | None = None
    game_duration: GameDuration | None = None


class PredictionResponse(PredictionFields):
    """Public prediction representation returned by API endpoints."""

    id: int
    user_id: int
    match_id: int
    predicted_datetime: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PredictionListResponse(BaseModel):
    """Paginated prediction list response."""

    items: list[PredictionResponse]
    total: int
    limit: int
    offset: int
