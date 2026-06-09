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


class MatchUserPointsDetailsResponse(BaseModel):
    """Scored prediction detail for one user on a single completed match."""

    user_id: int
    user_name: str
    predicted_team1_score: int | None
    predicted_team2_score: int | None
    score_points: int
    goal_difference_points: int
    predicted_yellow_card_count: int | None
    yellow_card_points: int
    predicted_red_card_count: int | None
    red_card_points: int
    predicted_kick_off_team: str | None
    kick_off_team_points: int
    predicted_first_scoring_team: str | None
    first_scoring_team_points: int
    predicted_first_goal_in: str | None
    first_goal_in_points: int
    predicted_match_duration: str | None
    match_duration_points: int
    total_points: int


class MatchPointsDetailsResponse(BaseModel):
    """Points breakdown for every active user on one completed match."""

    match_id: int
    match_label: str
    match_day: int
    team1_name: str
    team1_name_short: str
    team2_name: str
    team2_name_short: str
    team1_score: int | None
    team2_score: int | None
    yellow_card_count: int | None
    red_card_count: int | None
    kick_off_team: str | None
    first_scoring_team: str | None
    first_goal_in: str | None
    match_duration: str | None
    items: list[MatchUserPointsDetailsResponse]
    total: int = Field(..., ge=0)
