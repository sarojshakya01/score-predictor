"""Leaderboard scoring business logic."""

import logging
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import GameDuration, Match
from app.models.prediction import Prediction
from app.models.user import User
from app.repositories.match_repository import MatchRepository
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.leaderboard import (
    LeaderboardEntryResponse,
    LeaderboardRaceFrameResponse,
    LeaderboardRaceUserResponse,
    LeaderboardResponse,
)

logger = logging.getLogger(__name__)


@dataclass
class UserLeaderboardTotals:
    """Mutable leaderboard totals for a single user."""

    user_id: int
    name: str
    predicted_matches: int = 0
    score_points: int = 0
    goal_difference_points: int = 0
    yellow_card_points: int = 0
    red_card_points: int = 0
    kick_off_team_points: int = 0
    first_scoring_team_points: int = 0
    scored_in_first_half_points: int = 0
    match_duration_points: int = 0
    total_points: int = 0

    def to_response(self, *, rank: int) -> LeaderboardEntryResponse:
        """Convert accumulated totals to an API response schema."""
        return LeaderboardEntryResponse(
            rank=rank,
            user_id=self.user_id,
            name=self.name,
            predicted_matches=self.predicted_matches,
            score_points=self.score_points,
            goal_difference_points=self.goal_difference_points,
            yellow_card_points=self.yellow_card_points,
            red_card_points=self.red_card_points,
            kick_off_team_points=self.kick_off_team_points,
            first_scoring_team_points=self.first_scoring_team_points,
            scored_in_first_half_points=self.scored_in_first_half_points,
            match_duration_points=self.match_duration_points,
            total_points=self.total_points,
        )


@dataclass(frozen=True)
class PredictionScore:
    """Point breakdown for one prediction."""

    score_points: int
    goal_difference_points: int
    yellow_card_points: int
    red_card_points: int
    kick_off_team_points: int
    first_scoring_team_points: int
    scored_in_first_half_points: int
    match_duration_points: int
    total_points: int


class LeaderboardService:
    """Builds ranked users from completed matches and predictions."""

    def __init__(self, db: AsyncSession) -> None:
        self._match_repository = MatchRepository(db)
        self._prediction_repository = PredictionRepository(db)
        self._user_repository = UserRepository(db)

    async def get_leaderboard(
        self,
        *,
        offset: int,
        limit: int,
    ) -> LeaderboardResponse:
        """Return paginated leaderboard standings."""
        try:
            users = await self._user_repository.list_active_normal_users()
            completed_matches = await self._match_repository.list_completed_matches()
            predictions, prediction_counts = await self._get_prediction_data()

            totals = self._initialize_user_totals(
                users=users,
                prediction_counts=prediction_counts,
            )
            self._apply_prediction_scores(totals=totals, predictions=predictions)
            race_frames = self._build_race_frames(
                users=users,
                completed_matches=completed_matches,
                predictions=predictions,
            )

            ranked_totals = sorted(totals.values(), key=self._leaderboard_sort_key)
            ranked_entries = [
                total.to_response(rank=index + 1)
                for index, total in enumerate(ranked_totals)
            ]

            return LeaderboardResponse(
                items=ranked_entries[offset : offset + limit],
                race_frames=race_frames,
                total=len(ranked_entries),
                limit=limit,
                offset=offset,
                completed_matches=len(completed_matches),
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error during get_leaderboard", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not read leaderbord",
            )

    async def _get_prediction_data(
        self,
    ) -> tuple[list[Prediction], dict[int, int]]:
        """Fetch prediction data, tolerating local databases before prediction setup."""
        try:
            return (
                await self._prediction_repository.list_scored_predictions(),
                await self._prediction_repository.count_predictions_by_active_user(),
            )
        except ProgrammingError as error:
            if self._is_missing_predictions_table_error(error):
                logger.warning("Predictions table is missing; returning empty scores")
                return [], {}

            raise

    @staticmethod
    def _is_missing_predictions_table_error(error: ProgrammingError) -> bool:
        """Return whether a DB error is caused by a missing predictions table."""
        original_error_args = getattr(error.orig, "args", ())
        if original_error_args and original_error_args[0] == 1146:
            return True

        return "predictions" in str(error).lower() and "doesn't exist" in str(
            error,
        ).lower()

    @staticmethod
    def _initialize_user_totals(
        *,
        users: list[User],
        prediction_counts: dict[int, int],
    ) -> dict[int, UserLeaderboardTotals]:
        """Create zeroed totals for every active user."""
        return {
            user.id: UserLeaderboardTotals(
                user_id=user.id,
                name=LeaderboardService._format_user_name(user),
                predicted_matches=prediction_counts.get(user.id, 0),
            )
            for user in users
        }

    @staticmethod
    def _format_user_name(user: User) -> str:
        """Build a public display name without exposing contact details."""
        name_parts = [
            user.first_name.strip(),
            user.middle_name.strip() if user.middle_name else "",
            user.last_name.strip(),
        ]
        display_name = " ".join(part for part in name_parts if part)
        return display_name or f"User #{user.id}"

    @staticmethod
    def _apply_prediction_scores(
        *,
        totals: dict[int, UserLeaderboardTotals],
        predictions: list[Prediction],
    ) -> None:
        """Apply scored prediction totals to users."""
        for prediction in predictions:
            user_totals = totals.get(prediction.user_id)
            if user_totals is None:
                continue

            score = LeaderboardService._score_prediction(prediction)

            user_totals.score_points += score.score_points
            user_totals.goal_difference_points += score.goal_difference_points
            user_totals.kick_off_team_points += score.kick_off_team_points
            user_totals.yellow_card_points += score.yellow_card_points
            user_totals.red_card_points += score.red_card_points
            user_totals.first_scoring_team_points += score.first_scoring_team_points
            user_totals.scored_in_first_half_points += score.scored_in_first_half_points
            user_totals.match_duration_points += score.match_duration_points
            user_totals.total_points += score.total_points

    @staticmethod
    def _build_race_frames(
        *,
        users: list[User],
        completed_matches: list[Match],
        predictions: list[Prediction],
    ) -> list[LeaderboardRaceFrameResponse]:
        """Build cumulative leaderboard frames after each completed match."""
        user_names = {
            user.id: LeaderboardService._format_user_name(user) for user in users
        }
        cumulative_points = {user.id: 0 for user in users}
        predictions_by_match: dict[int, list[Prediction]] = {}

        for prediction in predictions:
            predictions_by_match.setdefault(prediction.match_id, []).append(prediction)

        frames = [
            LeaderboardRaceFrameResponse(
                frame=0,
                match_id=None,
                match_day=None,
                label="Tournament start",
                standings=LeaderboardService._build_race_standings(
                    user_names=user_names,
                    cumulative_points=cumulative_points,
                    match_points={},
                ),
            ),
        ]

        for frame_index, match in enumerate(completed_matches, start=1):
            match_points: dict[int, int] = {}

            for prediction in predictions_by_match.get(match.id, []):
                score = LeaderboardService._score_prediction(prediction)
                match_points[prediction.user_id] = score.total_points
                cumulative_points[prediction.user_id] = (
                    cumulative_points.get(prediction.user_id, 0) + score.total_points
                )

            frames.append(
                LeaderboardRaceFrameResponse(
                    frame=frame_index,
                    match_id=match.id,
                    match_day=match.match_day,
                    label=LeaderboardService._format_match_label(match),
                    standings=LeaderboardService._build_race_standings(
                        user_names=user_names,
                        cumulative_points=cumulative_points,
                        match_points=match_points,
                    ),
                ),
            )

        return frames

    @staticmethod
    def _build_race_standings(
        *,
        user_names: dict[int, str],
        cumulative_points: dict[int, int],
        match_points: dict[int, int],
    ) -> list[LeaderboardRaceUserResponse]:
        """Build ranked race standings from cumulative user points."""
        ranked_users = sorted(
            user_names.items(),
            key=lambda item: (-cumulative_points.get(item[0], 0), item[1]),
        )

        return [
            LeaderboardRaceUserResponse(
                rank=index + 1,
                user_id=user_id,
                name=name,
                total_points=cumulative_points.get(user_id, 0),
                match_points=match_points.get(user_id, 0),
            )
            for index, (user_id, name) in enumerate(ranked_users)
        ]

    @staticmethod
    def _format_match_label(match: Match) -> str:
        """Build the label shown for a leaderboard race frame."""
        return (
            f"Match day {match.match_day}: "
            f"{match.team1.name} vs {match.team2.name}"
        )

    @staticmethod
    def _score_prediction(prediction: Prediction) -> PredictionScore:
        """Score a prediction against its completed match."""
        match = prediction.match
        perfect_prediction = (
            prediction.team1_score == match.team1_score
            and prediction.team2_score == match.team2_score
        )
        correct_prediction = (
            LeaderboardService._score_result_sign(prediction.team1_score, prediction.team2_score)
            == LeaderboardService._score_result_sign(match.team1_score, match.team2_score)
        )

        score_points = 15 if perfect_prediction else 0
        if not perfect_prediction and correct_prediction:
            score_points = 5

        goal_difference_points = LeaderboardService._score_goal_difference(
            prediction=prediction,
            match=match,
        )

        kick_off_team_points = LeaderboardService._score_kick_off_team(prediction, match)
        yellow_card_points, red_card_points = LeaderboardService._score_cards(prediction, match)
        match_duration_points = LeaderboardService._score_duration(prediction, match)
        first_scoring_team_points = 5 if prediction.first_scoring_team_id == match.first_scoring_team_id else 0
        scored_in_first_half_points = 5 if prediction.is_goal_in_first_half == match.is_goal_in_first_half else 0

        return PredictionScore(
            score_points=score_points,
            goal_difference_points=goal_difference_points,
            kick_off_team_points=kick_off_team_points,
            yellow_card_points=yellow_card_points,
            red_card_points=red_card_points,
            first_scoring_team_points=first_scoring_team_points,
            scored_in_first_half_points=scored_in_first_half_points,
            match_duration_points=match_duration_points,
            total_points=(
                score_points
                + goal_difference_points
                + kick_off_team_points
                + yellow_card_points
                + red_card_points
                + first_scoring_team_points
                + scored_in_first_half_points
                + match_duration_points
            )
        )

    @staticmethod
    def _score_result_sign(team1_score: int | None, team2_score: int | None) -> int:
        """Return the match result direction from team scores."""
        if team1_score is None or team2_score is None:
            return 0

        if team1_score > team2_score:
            return 1

        if team1_score < team2_score:
            return -1

        return 0

    @staticmethod
    def _score_goal_difference(
        *,
        prediction: Prediction,
        match: Match,
    ) -> int:
        """Score predicted goal difference against the actual difference."""
        if (
            match.team1_score is None
            or match.team2_score is None
            or match.match_duration == GameDuration.PENALTY
        ):
            return 0

        predicted_difference = prediction.team1_score - prediction.team2_score
        actual_difference = match.team1_score - match.team2_score
        difference_delta = abs(predicted_difference - actual_difference)

        if difference_delta == 0:
            return 5

        if difference_delta == 1:
            return 3

        if difference_delta == 2:
            return 2

        if difference_delta == 3:
            return 1

        return 0

    @staticmethod
    def _score_duration(prediction: Prediction, match: Match) -> int:
        """Score game duration when the actual duration is available."""
        if match.match_duration is None or prediction.match_duration != match.match_duration:
            return 0

        if match.match_duration == GameDuration.REGULAR:
            return 5

        if match.match_duration == GameDuration.EXTRA_TIME:
            return 10

        return 15

    @staticmethod
    def _score_kick_off_team(prediction: Prediction, match: Match) -> int:
        """Score the kickoff team prediction."""
        if match.kick_off_team_id is None:
            return 0

        return 3 if prediction.kick_off_team_id == match.kick_off_team_id else 0

    @staticmethod
    def _score_cards(prediction: Prediction, match: Match) -> int:
        """Score yellow and red card predictions."""
        yellow_card_points = LeaderboardService._score_yellow_cards(
            predicted=prediction.yellow_card_count,
            actual=match.yellow_card_count,
        )
        
        red_card_points = LeaderboardService._score_red_cards(
            predicted=prediction.red_card_count,
            actual=match.red_card_count,
        )

        return yellow_card_points, red_card_points

    @staticmethod
    def _score_yellow_cards(*, predicted: int, actual: int | None) -> int:
        """Score yellow cards with the configured tolerance bands."""
        if predicted == 0 or actual is None:
            return 0

        difference = abs(predicted - actual)

        if difference == 0:
            return 5

        if difference == 1:
            return 3

        if difference == 2:
            return 2

        if difference == 3:
            return 1

        return 0

    @staticmethod
    def _score_red_cards(*, predicted: int, actual: int | None) -> int:
        """Score red cards, including the penalty for false positives."""
        if predicted == 0 or actual is None:
            return 0

        if predicted == actual:
            return 10

        if actual > 0:
            return 5

        return -2

    @staticmethod
    def _leaderboard_sort_key(
        totals: UserLeaderboardTotals,
    ) -> tuple[int, int, int, int, str]:
        """Sort users by score and high-signal tie breakers."""
        return (
            -totals.total_points,
            -totals.score_points,
            -totals.goal_difference_points,
            -totals.yellow_card_points,
            totals.name,
        )
