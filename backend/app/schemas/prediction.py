"""Pydantic schemas for prediction requests and responses."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.match import FirstGoalIn, MatchDuration


class PredictionFields(BaseModel):
    """Shared prediction fields supplied by users."""

    team1_score: int = Field(..., ge=0)
    team2_score: int = Field(..., ge=0)
    yellow_card_count: int = Field(..., ge=0)
    red_card_count: int = Field(..., ge=0)
    first_goal_in: FirstGoalIn | None = None
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    kick_off_team_id: int | None = Field(default=None, gt=0)
    match_duration: MatchDuration | None = None

    @model_validator(mode="after")
    def validate_goal_timeline_fields(self) -> "PredictionFields":
        """Require first-goal details only when goals are predicted."""
        has_predicted_goal = self.team1_score + self.team2_score > 0

        if not has_predicted_goal and self.first_goal_in is not None:
            raise ValueError("first_goal_in is only allowed when goals are predicted")

        if not has_predicted_goal and self.first_scoring_team_id is not None:
            raise ValueError("first_scoring_team_id is only allowed when goals are predicted")

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
    first_goal_in: FirstGoalIn | None = None
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    kick_off_team_id: int | None = Field(default=None, gt=0)
    match_duration: MatchDuration | None = None


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


class UserPointsDetailsResponse(BaseModel):
    """Scored prediction detail for a single completed match."""

    match_id: int
    match_label: str
    match_day: int
    team1_name: str
    team2_name_short: str
    team2_name: str
    team1_name_short: str
    team1_score: int | None
    team2_score: int | None
    predicted_team1_score: int | None
    predicted_team2_score: int | None
    # Yellow cards
    yellow_card_count: int | None
    predicted_yellow_card_count: int | None
    yellow_card_points: int
    # Red cards
    red_card_count: int | None
    predicted_red_card_count: int | None
    red_card_points: int
    # Kick-off team
    kick_off_team: str | None
    predicted_kick_off_team: str | None
    kick_off_team_points: int
    # First scoring team
    first_scoring_team: str | None
    predicted_first_scoring_team: str | None
    first_scoring_team_points: int
    # First goal in
    first_goal_in: FirstGoalIn | None
    predicted_first_goal_in: FirstGoalIn | None
    first_goal_in_points: int
    # Match duration
    match_duration: MatchDuration | None
    predicted_match_duration: MatchDuration | None
    match_duration_points: int
    # Summary
    score_points: int
    goal_difference_points: int
    total_points: int
    match_stage: str | None


class UserPointsDetailsListResponse(BaseModel):
    """List of points details from predictions of a user."""

    user_id: int
    user_name: str
    items: list[UserPointsDetailsResponse]
    total_points: int
    winner_points: int
    runner_up_points: int
    third_place_points: int

