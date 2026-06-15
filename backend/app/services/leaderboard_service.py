"""Leaderboard scoring business logic."""
from app.models.match import MatchStage
from app.models.match import FirstGoalIn
from app.schemas.leaderboard import LeaderboardFrame, AccumulatedPoints
from app.api.deps import CurrentUser
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
    MatchPointsDetailsResponse,
    MatchUserPointsDetailsResponse,
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
class FirstGoalTimingRules:
    """Points for the first goal in category."""
    first_half: int = 3
    second_half: int = 5
    extra_time: int = 10


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
    winner: int = 100
    runner_up: int = 50
    third_place: int = 25
    score: ScoreRules = field(default_factory=ScoreRules)
    goal_difference: BandedRules = field(default_factory=BandedRules)
    yellow_card: BandedRules = field(default_factory=BandedRules)
    red_card: RedCardRules = field(default_factory=RedCardRules)
    first_score_by: int = 3    # single point value (order 1)
    first_goal_in: FirstGoalTimingRules = field(default_factory=FirstGoalTimingRules)
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

    first_goal_in_rules_list = by_name.get("first_goal_in", [])
    try:
        first_goal_in = FirstGoalTimingRules(
            first_half=_pick(first_goal_in_rules_list, 1),
            second_half=_pick(first_goal_in_rules_list, 2),
            extra_time=_pick(first_goal_in_rules_list, 3),
        )
    except (KeyError, ValueError):
        logger.warning("Falling back to defaults for match_duration rules")
        duration = DurationRules()

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
        first_score_by=single("first_score_by", order=1, default=3),
        first_goal_in=first_goal_in,
        duration=duration,
    )


# ── Leaderboard dataclasses ───────────────────────────────────────────────────

@dataclass
class UserLeaderboardTotals:
    """Mutable leaderboard totals for a single user."""

    user_id: int
    name: str
    predicted_matches: int = 0
    winner_points: int = 0
    runner_up_points: int = 0
    third_place_points: int = 0
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
            final_matches = await self._match_repository.list_finals(include_locked=True)

            totals = self._initialize_user_totals(
                users=users,
                prediction_counts=prediction_counts,
            )

            self._apply_prediction_scores(totals=totals, predictions=predictions, final_matches=final_matches, users=users, rules=rules)
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
        current_user: CurrentUser,
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

            locked_matches = await self._match_repository.list_locked_matches()

            current_match_day = await self._setting_repository.get_by_name("current_match_day")

            points_from_predictions = await self._prediction_repository.list_points_from_predictions_of_user(
                current_user=current_user, user_id=user_id, current_match_day=int(current_match_day.value['day']), locked_matches=locked_matches
            )

            items: list[UserPointsDetailsResponse] = []
            running_total = 0

            for point_from_prediction in points_from_predictions:
                match = point_from_prediction.match
                score = self._score_prediction(point_from_prediction, rules)
                running_total += score.total_points
                team1_name = match.team1.name
                team1_name_short = match.team1.fifa_code
                team2_name = match.team2.name
                team2_name_short = match.team2.fifa_code

                items.append(
                    UserPointsDetailsResponse(
                        match_id=match.id,
                        match_label=self._format_match_label(match),
                        match_day=match.match_day,
                        team1_name=team1_name,
                        team1_name_short=team1_name_short,
                        team2_name=team2_name,
                        team2_name_short=team2_name_short,
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
                        predicted_kick_off_team=point_from_prediction.kick_off_team.name if point_from_prediction.kick_off_team else None,
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
                        predicted_match_duration=point_from_prediction.match_duration.value if point_from_prediction.match_duration else None,
                        match_duration_points=score.match_duration_points,
                        # Summary
                        score_points=score.score_points,
                        goal_difference_points=score.goal_difference_points,
                        total_points=score.total_points,
                        match_stage=match.match_stage
                    )
                )

            final_matches = await self._match_repository.list_finals(include_locked=True)
            winner_points, runner_up_points, third_place_points = self._calculate_finalist_points(final_matches, user, rules)

            return UserPointsDetailsListResponse(
                user_id=user_id,
                user_name=self._format_user_name(user),
                items=items,
                total_points=running_total + winner_points + runner_up_points + third_place_points,
                winner_points=winner_points,
                runner_up_points=runner_up_points,
                third_place_points=third_place_points,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error during get_user_points_details", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not read user points details",
            )

    async def get_match_points_details(
        self,
        *,
        match_id: int,
    ) -> MatchPointsDetailsResponse:
        """Return scored points details for every active user on one match."""
        try:
            rules = await self._get_scoring_rules()
            match = await self._match_repository.get_by_id(match_id)
            if match is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Match not found",
                )

            if (
                not match.match_locked
                or match.team1_score is None
                or match.team2_score is None
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Match result is not available yet",
                )

            users = await self._user_repository.list_active_normal_users()
            predictions = await self._prediction_repository.list_predictions_for_match(match_id)
            predictions_by_user = {prediction.user_id: prediction for prediction in predictions}
            items: list[MatchUserPointsDetailsResponse] = []

            for user in users:
                prediction = predictions_by_user.get(user.id)
                if prediction is None:
                    prediction = self._prediction_repository.to_dummy_prediction_for_match(
                        user.id,
                        match,
                    )

                extra_points = 0

                if match.match_stage == MatchStage.FINAL and (match.team1_id == user.winner_team_id or match.team2_id == user.winner_team_id):
                    extra_points = rules.winner
                elif match.match_stage == MatchStage.FINAL and (match.team1_id == user.runner_up_team_id or match.team2_id == user.runner_up_team_id):
                    extra_points = rules.runner_up
                elif match.match_stage == MatchStage.THIRD_PLACE and (match.team1_id == user.third_place_team_id or match.team2_id == user.third_place_team_id):
                    extra_points = rules.third_place

                score = self._score_prediction(prediction, rules)
                items.append(
                    MatchUserPointsDetailsResponse(
                        user_id=user.id,
                        user_name=self._format_user_name(user),
                        predicted_team1_score=prediction.team1_score,
                        predicted_team2_score=prediction.team2_score,
                        extra_points=extra_points,
                        score_points=score.score_points,
                        goal_difference_points=score.goal_difference_points,
                        predicted_yellow_card_count=prediction.yellow_card_count,
                        yellow_card_points=score.yellow_card_points,
                        predicted_red_card_count=prediction.red_card_count,
                        red_card_points=score.red_card_points,
                        predicted_kick_off_team=prediction.kick_off_team.name if prediction.kick_off_team else None,
                        kick_off_team_points=score.kick_off_team_points,
                        predicted_first_scoring_team=prediction.first_scoring_team.name if prediction.first_scoring_team else None,
                        first_scoring_team_points=score.first_scoring_team_points,
                        predicted_first_goal_in=prediction.first_goal_in,
                        first_goal_in_points=score.first_goal_in_points,
                        predicted_match_duration=prediction.match_duration.value if prediction.match_duration else None,
                        match_duration_points=score.match_duration_points,
                        total_points=score.total_points + extra_points,
                    )
                )

            items.sort(key=lambda item: (item.total_points, item.user_name.lower(), item.user_id), reverse=True)

            return MatchPointsDetailsResponse(
                match_id=match.id,
                match_label=self._format_match_label(match),
                match_day=match.match_day,
                team1_name=match.team1.name,
                team1_name_short=match.team1.fifa_code,
                team2_name=match.team2.name,
                team2_name_short=match.team2.fifa_code,
                team1_score=match.team1_score,
                team2_score=match.team2_score,
                yellow_card_count=match.yellow_card_count,
                red_card_count=match.red_card_count,
                kick_off_team=match.kick_off_team.name if match.kick_off_team else None,
                first_scoring_team=match.first_scoring_team.name if match.first_scoring_team else None,
                first_goal_in=match.first_goal_in,
                match_duration=match.match_duration.value if match.match_duration else None,
                items=items,
                total=len(items),
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error during get_match_points_details", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not read match points details",
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
        final_matches: list[Match],
        users: list[User],
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
        
        for user in users:
            user_totals = totals.get(user.id)
            winner_points, runner_up_points, third_place_points = LeaderboardService._calculate_finalist_points(final_matches, user, rules)

            user_totals.winner_points = winner_points
            user_totals.runner_up_points = runner_up_points
            user_totals.third_place_points = third_place_points
            user_totals.total_points += winner_points + runner_up_points + third_place_points

    @staticmethod
    def _build_race_frames(
        *,
        users: list[User],
        completed_matches: list[Match],
        predictions: list[Prediction],
        rules: ScoringRules,
    ) -> list[LeaderboardFrame]:
        """Build cumulative leaderboard frames after each completed match."""

        user_names = {
            user.id: LeaderboardService._format_user_name(user)
            for user in users
        }

        # Starting points from finalist predictions
        cumulative_points = {}

        for user in users:
            winner_points, runner_up_points, third_place_points = (
                LeaderboardService._calculate_finalist_points(
                    completed_matches,
                    user,
                    rules,
                )
            )

            cumulative_points[user.id] = (
                winner_points
                + runner_up_points
                + third_place_points
            )

        predictions_by_match: dict[int, list[Prediction]] = {}

        for prediction in predictions:
            predictions_by_match.setdefault(
                prediction.match_id,
                [],
            ).append(prediction)

        user_match_points: dict[int, list[AccumulatedPoints]] = {
            user.id: []
            for user in users
        }

        for idx, match in enumerate(completed_matches, start=1):

            for prediction in predictions_by_match.get(match.id, []):
                score = LeaderboardService._score_prediction(
                    prediction,
                    rules,
                )

                cumulative_points[prediction.user_id] += (
                    score.total_points
                )

            # Capture standings after this match
            for user in users:
                user_match_points[user.id].append(
                    AccumulatedPoints(
                        match_num=idx,
                        acc_points=cumulative_points[user.id],
                    )
                )

        return [
            LeaderboardFrame(
                user_id=user.id,
                user_name=user_names[user.id],
                acc_points=user_match_points[user.id],
            )
            for user in users
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

        # for not predicted match, return 0 points
        if prediction.id is None or not prediction.match.match_locked:
            return PredictionScore(
                score_points=0,
                goal_difference_points=0,
                kick_off_team_points=0,
                yellow_card_points=0,
                red_card_points=0,
                first_scoring_team_points=0,
                first_goal_in_points=0,
                match_duration_points=0,
                total_points=0,
            )

        match = prediction.match
        has_score_prediction = (
            prediction.team1_score is not None
            or prediction.team2_score is not None
        )

        if has_score_prediction:
            perfect_prediction = (
                prediction.team1_score == match.team1_score
                and prediction.team2_score == match.team2_score
            )
            correct_winner = (
                LeaderboardService._score_result_sign(
                    prediction.team1_score,
                    prediction.team2_score,
                )
                == LeaderboardService._score_result_sign(
                    match.team1_score,
                    match.team2_score,
                )
            )

            if perfect_prediction:
                score_points = rules.score.perfect
            elif correct_winner:
                score_points = rules.score.correct_winner
            else:
                score_points = 0
        else:
            score_points = 0

        goal_difference_points = LeaderboardService._score_goal_difference(
            prediction=prediction,
            match=match,
            rules=rules.goal_difference,
        )
        
        yellow_card_points, red_card_points = LeaderboardService._score_cards(
            prediction, match, rules,
        )

        has_predicted_goals = (
            (prediction.team1_score or 0) + (prediction.team2_score or 0) > 0
        )

        first_goal_in_points = LeaderboardService._score_first_goal_in(
            prediction, match, rules.first_goal_in,
        )

        first_scoring_team_points = (
            rules.first_score_by
            if has_predicted_goals and prediction.first_scoring_team_id == match.first_scoring_team_id
            else min(rules.first_score_by.first_half, rules.first_score_by.second_half, rules.first_score_by.extra_time) if match.team1_score == 0 and match.team2_score == 0
            else 0
        )

        kick_off_team_points = LeaderboardService._score_kick_off_team(
            prediction, match, rules.kick_off_team,
        )

        match_duration_points = LeaderboardService._score_duration(
            prediction, match, rules.duration,
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
    def _score_first_goal_in(
        prediction: Prediction,
        match: Match,
        rules: FirstGoalTimingRules,
    ) -> int:
        """Score first goal in prediction against the actual first goal in."""
        if (
            match.first_goal_in is None
            or prediction.first_goal_in != match.first_goal_in
            or (prediction.team1_score is not None and prediction.team2_score is not None)
        ):
            return 0

        if match.first_goal_in == FirstGoalIn.FIRST_HALF:
            return rules.first_half
        if match.first_goal_in == FirstGoalIn.SECOND_HALF:
            return rules.second_half
        if match.first_goal_in == FirstGoalIn.EXTRA_TIME:
            return rules.extra_time
        if prediction.team1_score == 0 and match.team2_score == 0:
            return min(rules.first_half, rules.second_half, rules.extra_time)
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
            or prediction.team1_score is None
            or prediction.team2_score is None
            or match.match_duration == MatchDuration.PENALTY
        ):
            return 0

        predicted_diff = prediction.team1_score - prediction.team2_score
        actual_diff = match.team1_score - match.team2_score

        # if winning team is not correct, return 0 points
        if predicted_diff < 0 and actual_diff > 0:
            return 0
        if predicted_diff > 0 and actual_diff < 0:
            return 0
        if actual_diff != 0 and predicted_diff == 0:
            return 0
        if actual_diff == 0 and predicted_diff != 0:
            return 0

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
        predicted: int | None,
        actual: int | None,
        rules: BandedRules,
    ) -> int:
        """Score yellow cards with the configured tolerance bands."""
        if predicted is None or actual is None:
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
        predicted: int | None,
        actual: int | None,
        rules: RedCardRules,
    ) -> int:
        """Score red cards, including the penalty for false positives."""
        if predicted is None or predicted <= 0:
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
            -totals.winner_points,
            -totals.runner_up_points,
            -totals.third_place_points,
            -totals.score_points,
            -totals.goal_difference_points,
            -totals.first_goal_in_points,
            -totals.first_scoring_team_points,
            -totals.yellow_card_points,
            -totals.red_card_points,
            -totals.kick_off_team_points,
            -totals.match_duration_points,
            totals.name,
        )

    @staticmethod
    def _calculate_finalist_points(final_matches: list[Match], user: User, rules: ScoringRules) -> tuple[int, int, int]:
        """Get points from finalist predictions."""
        third_place_match = next((m for m in final_matches if m.match_stage == MatchStage.THIRD_PLACE), None)
        final_match = next((m for m in final_matches if m.match_stage == MatchStage.FINAL), None)

        runner_up_team = (
            final_match.team2_id
            if final_match is not None and final_match.team1_id == final_match.winner_id
            else (
                final_match.team1_id
                if final_match is not None
                else None
            )
        )

        winner_points = rules.winner if user.winner_team_id is not None and final_match is not None and user.winner_team_id == final_match.winner else 0
        runner_up_points = rules.runner_up if user.runner_up_team_id is not None and runner_up_team is not None and user.runner_up_team_id == runner_up_team else 0
        third_place_points = rules.third_place if user.third_place_team_id is not None and third_place_match is not None and user.third_place_team_id == third_place_match.winner_id else 0
        return winner_points, runner_up_points, third_place_points
