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
    kick_off_team_id: int = Field(..., gt=0)
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    first_goal_in: FirstGoalIn | None = None
    match_duration: MatchDuration

    @model_validator(mode="after")
    def validate_goal_timeline_fields(self) -> "PredictionFields":
        """Require first-goal details only when goals are predicted."""
        has_predicted_goal = self.team1_score + self.team2_score > 0

        if has_predicted_goal and self.first_goal_in is None:
            raise ValueError("first_goal_in is required when goals are predicted")

        has_goals_from_both_teams = self.team1_score > 0 and self.team2_score > 0

        if has_goals_from_both_teams and self.first_scoring_team_id is None:
            raise ValueError("first_scoring_team_id is required when goals from both teams are predicted")

        if not has_predicted_goal and self.first_goal_in is not None:
            raise ValueError("first_goal_in is only allowed when goals are predicted")

        if not has_goals_from_both_teams and self.first_scoring_team_id is not None:
            raise ValueError("first_scoring_team_id is only allowed when goals from both teams are predicted")

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
    kick_off_team_id: int | None = Field(default=None, gt=0)
    first_scoring_team_id: int | None = Field(default=None, gt=0)
    first_goal_in: FirstGoalIn | None = None
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
    team2_name: str
    team1_score: int
    team2_score: int
    predicted_team1_score: int
    predicted_team2_score: int
    # Yellow cards
    yellow_card_count: int | None
    predicted_yellow_card_count: int
    yellow_card_points: int
    # Red cards
    red_card_count: int | None
    predicted_red_card_count: int
    red_card_points: int
    # Kick-off team
    kick_off_team: str | None
    predicted_kick_off_team: str
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
    predicted_match_duration: MatchDuration
    match_duration_points: int
    # Summary
    score_points: int
    goal_difference_points: int
    total_points: int


class UserPointsDetailsListResponse(BaseModel):
    """List of points details from predictions of a user."""

    user_id: int
    user_name: str
    items: list[UserPointsDetailsResponse]
    total_points: int

