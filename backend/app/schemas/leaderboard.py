"""Pydantic schemas for leaderboard responses."""

from pydantic import BaseModel, Field


class LeaderboardEntryResponse(BaseModel):
    """Single ranked user on the leaderboard."""

    rank: int = Field(..., gt=0)
    user_id: int
    name: str
    score_points: int = Field(..., ge=0)
    goal_difference_points: int
    yellow_card_points: int
    red_card_points: int
    kick_off_team_points: int
    first_scoring_team_points: int
    first_goal_in_points: int
    match_duration_points: int
    total_points: int
    predicted_matches: int = Field(..., ge=0)


class LeaderboardRaceUserResponse(BaseModel):
    """User position within one leaderboard race frame."""

    rank: int = Field(..., gt=0)
    user_id: int
    name: str
    total_points: int
    match_points: int


class LeaderboardRaceFrameResponse(BaseModel):
    """Cumulative standings after one completed match."""

    frame: int = Field(..., ge=0)
    match_id: int | None
    match_day: int | None
    label: str
    standings: list[LeaderboardRaceUserResponse]


class LeaderboardResponse(BaseModel):
    """Paginated leaderboard response."""

    items: list[LeaderboardEntryResponse]
    race_frames: list[LeaderboardRaceFrameResponse]
    total: int = Field(..., ge=0)
    limit: int = Field(..., ge=1)
    offset: int = Field(..., ge=0)
    completed_matches: int = Field(..., ge=0)
