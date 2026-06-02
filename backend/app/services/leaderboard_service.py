"""Leaderboard scoring business logic."""

import logging
from dataclasses import dataclass, field

from fastapi import HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import MatchDuration, Match
from app.models.prediction import Prediction
from app.models.user import User
from app.repositories.match_repository import MatchRepository
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.setting_repository import SettingRepository
from app.repositories.user_repository import UserRepository
from app.schemas.leaderboard import (
    LeaderboardEntryResponse,
    LeaderboardRaceFrameResponse,
    LeaderboardRaceUserResponse,
    LeaderboardResponse,
)
from app.schemas.prediction import (
    UserPointsDetailsListResponse,
    UserPointsDetailsResponse,
)

logger = logging.getLogger(__name__)


# ── Scoring rules dataclasses ─────────────────────────────────────────────────

@dataclass(frozen=True)
class ScoreRules:
    """Points for the score category."""
    perfect: int = 15       # exact score
    correct_winner: int = 5 # right winner, wrong score


@dataclass(frozen=True)
class BandedRules:
    """Points for tolerance-banded categories (goal diff, yellow/red cards)."""
    exact: int = 0
    miss_1: int = 0
    miss_2: int = 0
    miss_3: int = 0


@dataclass(frozen=True)
class RedCardRules:
    """Points for the red card category."""
    exact: int = 10
    predicted_and_given: int = 5
    predicted_not_given: int = -2


@dataclass(frozen=True)
class DurationRules:
    """Points for the match duration category."""
    regular: int = 5      # 90 min
    extra_time: int = 10  # 120 min
    penalty: int = 15     # penalty shootout


@dataclass(frozen=True)
class ScoringRules:
    """Complete point table loaded from the game_rules setting."""
    score: ScoreRules = field(default_factory=ScoreRules)
    goal_difference: BandedRules = field(default_factory=BandedRules)
    yellow_card: BandedRules = field(default_factory=BandedRules)
    red_card: RedCardRules = field(default_factory=RedCardRules)
    first_score_by: int = 3    # single point value (order 1)
    first_goal_in: int = 3     # single point value (order 1)
    kick_off_team: int = 3     # not in settings — kept here as fallback
    duration: DurationRules = field(default_factory=DurationRules)


def _pick(rules: list[dict], order: int) -> int:
    """Return the `points` value for the rule entry matching `order`."""
    for r in rules:
        if r.get("order") == order:
            return int(r["points"])
    raise KeyError(f"No rule entry with order={order}")


def _parse_scoring_rules(raw_groups: list[dict]) -> ScoringRules:
    """
    Parse the `game_rules` JSON value into a ScoringRules dataclass.

    Each group is matched by its `name` field. Missing groups fall back to
    the dataclass defaults so a misconfigured setting never crashes scoring.
    """
    by_name: dict[str, list[dict]] = {}
    for group in raw_groups:
        by_name[group["name"]] = group.get("rules", [])

    def banded(name: str) -> BandedRules:
        rules = by_name.get(name, [])
        try:
            return BandedRules(
                exact=_pick(rules, 1),
                miss_1=_pick(rules, 2),
                miss_2=_pick(rules, 3),
                miss_3=_pick(rules, 4),
            )
        except (KeyError, ValueError):
            logger.warning("Falling back to defaults for banded rule group '%s'", name)
            return BandedRules()

    def single(name: str, order: int = 1, default: int = 0) -> int:
        rules = by_name.get(name, [])
        try:
            return _pick(rules, order)
        except (KeyError, ValueError):
            logger.warning("Falling back to default for single rule '%s' order %d", name, order)
            return default

    score_rules_list = by_name.get("score", [])
    try:
        score = ScoreRules(
            perfect=_pick(score_rules_list, 1),
            correct_winner=_pick(score_rules_list, 2),
        )
    except (KeyError, ValueError):
        logger.warning("Falling back to defaults for score rules")
        score = ScoreRules()

    red_rules_list = by_name.get("red_card", [])
    try:
        red_card = RedCardRules(
            exact=_pick(red_rules_list, 1),
            predicted_and_given=_pick(red_rules_list, 2),
            predicted_not_given=_pick(red_rules_list, 3),
        )
    except (KeyError, ValueError):
        logger.warning("Falling back to defaults for red_card rules")
        red_card = RedCardRules()

    duration_rules_list = by_name.get("match_duration", [])
    try:
        duration = DurationRules(
            regular=_pick(duration_rules_list, 1),
            extra_time=_pick(duration_rules_list, 2),
            penalty=_pick(duration_rules_list, 3),
        )
    except (KeyError, ValueError):
        logger.warning("Falling back to defaults for match_duration rules")
        duration = DurationRules()

    return ScoringRules(
        score=score,
        goal_difference=banded("goal_difference"),
        yellow_card=banded("yellow_card"),
        red_card=red_card,
        first_score_by=single("first_score_by", order=1, default=5),
        first_goal_in=single("first_goal_in", order=1, default=5),
        duration=duration,
    )


# ── Leaderboard dataclasses ───────────────────────────────────────────────────

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
    first_goal_in_points: int = 0
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
            first_goal_in_points=self.first_goal_in_points,
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
    first_goal_in_points: int
    match_duration_points: int
    total_points: int


# ── Service ───────────────────────────────────────────────────────────────────

class LeaderboardService:
    """Builds ranked users from completed matches and predictions."""

    def __init__(self, db: AsyncSession) -> None:
        self._match_repository = MatchRepository(db)
        self._prediction_repository = PredictionRepository(db)
        self._user_repository = UserRepository(db)
        self._setting_repository = SettingRepository(db)
        self._scoring_rules: ScoringRules | None = None

    async def _get_scoring_rules(self) -> ScoringRules:
        """Load and cache ScoringRules for the lifetime of this service instance."""
        if self._scoring_rules is not None:
            return self._scoring_rules

        setting = await self._setting_repository.get_by_name("game_rules")
        if setting is None:
            logger.warning("game_rules setting not found — using default scoring rules")
            self._scoring_rules = ScoringRules()
            return self._scoring_rules

        try:
            raw_groups: list[dict] = setting.value["rules"]
            self._scoring_rules = _parse_scoring_rules(raw_groups)
        except Exception:
            logger.exception("Failed to parse game_rules setting — using default scoring rules")
            self._scoring_rules = ScoringRules()

        return self._scoring_rules

    async def get_leaderboard(
        self,
        *,
        offset: int,
        limit: int,
    ) -> LeaderboardResponse:
        """Return paginated leaderboard standings."""
        try:
            rules = await self._get_scoring_rules()
            users = await self._user_repository.list_active_normal_users()
            completed_matches = await self._match_repository.list_completed_matches()
            predictions, prediction_counts = await self._get_prediction_data()

            totals = self._initialize_user_totals(
                users=users,
                prediction_counts=prediction_counts,
            )
            self._apply_prediction_scores(totals=totals, predictions=predictions, rules=rules)
            race_frames = self._build_race_frames(
                users=users,
                completed_matches=completed_matches,
                predictions=predictions,
                rules=rules,
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

    async def get_user_points_details(
        self,
        *,
        user_id: int,
    ) -> UserPointsDetailsListResponse:
        """Return scored points details for a user across all completed matches."""
        try:
            rules = await self._get_scoring_rules()

            user = await self._user_repository.get_by_id(user_id)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found",
                )

            points_from_predictions = await self._prediction_repository.list_points_from_predictions_of_user(
                user_id=user_id,
            )

            items: list[UserPointsDetailsResponse] = []
            running_total = 0

            for point_from_prediction in points_from_predictions:
                match = point_from_prediction.match
                score = self._score_prediction(point_from_prediction, rules)
                running_total += score.total_points
                team1_name = match.team1.name
                team2_name = match.team2.name
                items.append(
                    UserPointsDetailsResponse(
                        match_id=match.id,
                        match_label=self._format_match_label(match),
                        match_day=match.match_day,
                        team1_name=team1_name,
                        team2_name=team2_name,
                        team1_score=match.team1_score,
                        team2_score=match.team2_score,
                        predicted_team1_score=point_from_prediction.team1_score,
                        predicted_team2_score=point_from_prediction.team2_score,
                        # Yellow cards
                        yellow_card_count=match.yellow_card_count,
                        predicted_yellow_card_count=point_from_prediction.yellow_card_count,
                        yellow_card_points=score.yellow_card_points,
                        # Red cards
                        red_card_count=match.red_card_count,
                        predicted_red_card_count=point_from_prediction.red_card_count,
                        red_card_points=score.red_card_points,
                        # Kick-off team
                        kick_off_team=match.kick_off_team.name if match.kick_off_team else None,
                        predicted_kick_off_team=point_from_prediction.kick_off_team.name,
                        kick_off_team_points=score.kick_off_team_points,
                        # First scoring team
                        first_scoring_team=match.first_scoring_team.name if match.first_scoring_team else None,
                        predicted_first_scoring_team=point_from_prediction.first_scoring_team.name if point_from_prediction.first_scoring_team else None,
                        first_scoring_team_points=score.first_scoring_team_points,
                        # First goal in
                        first_goal_in=match.first_goal_in,
                        predicted_first_goal_in=point_from_prediction.first_goal_in,
                        first_goal_in_points=score.first_goal_in_points,
                        # Match duration
                        match_duration=match.match_duration.value if match.match_duration else None,
                        predicted_match_duration=point_from_prediction.match_duration.value,
                        match_duration_points=score.match_duration_points,
                        # Summary
                        score_points=score.score_points,
                        goal_difference_points=score.goal_difference_points,
                        total_points=score.total_points,
                    )
                )

            return UserPointsDetailsListResponse(
                user_id=user_id,
                user_name=self._format_user_name(user),
                items=items,
                total_points=running_total,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error during get_user_points_details", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not read user points details",
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
        return "predictions" in str(error).lower() and "doesn't exist" in str(error).lower()

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
        rules: ScoringRules,
    ) -> None:
        """Apply scored prediction totals to users."""
        for prediction in predictions:
            user_totals = totals.get(prediction.user_id)
            if user_totals is None:
                continue

            score = LeaderboardService._score_prediction(prediction, rules)

            user_totals.score_points += score.score_points
            user_totals.goal_difference_points += score.goal_difference_points
            user_totals.kick_off_team_points += score.kick_off_team_points
            user_totals.yellow_card_points += score.yellow_card_points
            user_totals.red_card_points += score.red_card_points
            user_totals.first_scoring_team_points += score.first_scoring_team_points
            user_totals.first_goal_in_points += score.first_goal_in_points
            user_totals.match_duration_points += score.match_duration_points
            user_totals.total_points += score.total_points

    @staticmethod
    def _build_race_frames(
        *,
        users: list[User],
        completed_matches: list[Match],
        predictions: list[Prediction],
        rules: ScoringRules,
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
                score = LeaderboardService._score_prediction(prediction, rules)
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
    def _score_prediction(prediction: Prediction, rules: ScoringRules) -> PredictionScore:
        """Score a prediction against its completed match using live scoring rules."""
        match = prediction.match
        perfect_prediction = (
            prediction.team1_score == match.team1_score
            and prediction.team2_score == match.team2_score
        )
        correct_winner = (
            LeaderboardService._score_result_sign(prediction.team1_score, prediction.team2_score)
            == LeaderboardService._score_result_sign(match.team1_score, match.team2_score)
        )

        if perfect_prediction:
            score_points = rules.score.perfect
        elif correct_winner:
            score_points = rules.score.correct_winner
        else:
            score_points = 0

        goal_difference_points = LeaderboardService._score_goal_difference(
            prediction=prediction,
            match=match,
            rules=rules.goal_difference,
        )
        kick_off_team_points = LeaderboardService._score_kick_off_team(
            prediction, match, rules.kick_off_team,
        )
        yellow_card_points, red_card_points = LeaderboardService._score_cards(
            prediction, match, rules,
        )
        match_duration_points = LeaderboardService._score_duration(
            prediction, match, rules.duration,
        )

        has_predicted_goals = (
            (prediction.team1_score or 0) + (prediction.team2_score or 0) > 0
        )
        first_scoring_team_points = (
            rules.first_score_by
            if has_predicted_goals and prediction.first_scoring_team_id == match.first_scoring_team_id
            else 0
        )
        first_goal_in_points = (
            rules.first_goal_in
            if has_predicted_goals and prediction.first_goal_in == match.first_goal_in
            else 0
        )

        return PredictionScore(
            score_points=score_points,
            goal_difference_points=goal_difference_points,
            kick_off_team_points=kick_off_team_points,
            yellow_card_points=yellow_card_points,
            red_card_points=red_card_points,
            first_scoring_team_points=first_scoring_team_points,
            first_goal_in_points=first_goal_in_points,
            match_duration_points=match_duration_points,
            total_points=(
                score_points
                + goal_difference_points
                + kick_off_team_points
                + yellow_card_points
                + red_card_points
                + first_scoring_team_points
                + first_goal_in_points
                + match_duration_points
            ),
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
        rules: BandedRules,
    ) -> int:
        """Score predicted goal difference against the actual difference."""
        if (
            match.team1_score is None
            or match.team2_score is None
            or match.match_duration == MatchDuration.PENALTY
        ):
            return 0

        predicted_diff = prediction.team1_score - prediction.team2_score
        actual_diff = match.team1_score - match.team2_score
        delta = abs(predicted_diff - actual_diff)

        if delta == 0:
            return rules.exact
        if delta == 1:
            return rules.miss_1
        if delta == 2:
            return rules.miss_2
        if delta == 3:
            return rules.miss_3
        return 0

    @staticmethod
    def _score_duration(
        prediction: Prediction,
        match: Match,
        rules: DurationRules,
    ) -> int:
        """Score match duration when the actual duration is available."""
        if match.match_duration is None or prediction.match_duration != match.match_duration:
            return 0
        if match.match_duration == MatchDuration.REGULAR:
            return rules.regular
        if match.match_duration == MatchDuration.EXTRA_TIME:
            return rules.extra_time
        return rules.penalty

    @staticmethod
    def _score_kick_off_team(
        prediction: Prediction,
        match: Match,
        points: int,
    ) -> int:
        """Score the kickoff team prediction."""
        if match.kick_off_team_id is None:
            return 0
        return points if prediction.kick_off_team_id == match.kick_off_team_id else 0

    @staticmethod
    def _score_cards(
        prediction: Prediction,
        match: Match,
        rules: ScoringRules,
    ) -> tuple[int, int]:
        """Score yellow and red card predictions."""
        yellow = LeaderboardService._score_yellow_cards(
            predicted=prediction.yellow_card_count,
            actual=match.yellow_card_count,
            rules=rules.yellow_card,
        )
        red = LeaderboardService._score_red_cards(
            predicted=prediction.red_card_count,
            actual=match.red_card_count,
            rules=rules.red_card,
        )
        return yellow, red

    @staticmethod
    def _score_yellow_cards(
        *,
        predicted: int,
        actual: int | None,
        rules: BandedRules,
    ) -> int:
        """Score yellow cards with the configured tolerance bands."""
        if predicted == 0 or actual is None:
            return 0

        delta = abs(predicted - actual)
        if delta == 0:
            return rules.exact
        if delta == 1:
            return rules.miss_1
        if delta == 2:
            return rules.miss_2
        if delta == 3:
            return rules.miss_3
        return 0

    @staticmethod
    def _score_red_cards(
        *,
        predicted: int,
        actual: int | None,
        rules: RedCardRules,
    ) -> int:
        """Score red cards, including the penalty for false positives."""
        if predicted <= 0:
            return 0
        if actual is not None and predicted == actual:
            return rules.exact
        if actual is not None and actual > 0:
            return rules.predicted_and_given
        return rules.predicted_not_given

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
