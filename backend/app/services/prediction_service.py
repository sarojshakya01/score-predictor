"""Prediction business logic."""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match, FirstGoalIn
from app.models.prediction import Prediction
from app.repositories.match_repository import MatchRepository
from app.repositories.prediction_repository import PredictionRepository
from app.schemas.prediction import (
    PredictionCreate,
    PredictionListResponse,
    PredictionResponse,
    PredictionUpdate,
)

logger = logging.getLogger(__name__)

class PredictionService:
    """Handles prediction validation and orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self._prediction_repository = PredictionRepository(db)
        self._match_repository = MatchRepository(db)

    async def list_current_user_predictions(
        self,
        *,
        user_id: int,
        offset: int,
        limit: int,
        match_id: int | None = None,
    ) -> PredictionListResponse:
        """Return paginated predictions for the current user."""
        try:
            predictions = await self._prediction_repository.list_predictions(
                offset=offset,
                limit=limit,
                user_id=user_id,
                match_id=match_id,
            )
            total = await self._prediction_repository.count_predictions(
                user_id=user_id,
                match_id=match_id,
            )
            return self._build_list_response(
                predictions=predictions,
                total=total,
                limit=limit,
                offset=offset,
            )
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during list_current_user_predictions", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not list predictions",
            )

    async def create_prediction(
        self,
        *,
        user_id: int,
        data: PredictionCreate,
    ) -> PredictionResponse:
        """Create a user's prediction for a match."""
        try:
            match = await self._get_match_or_404(data.match_id)
            self._ensure_prediction_is_open(match)
            values = data.model_dump()
            self._validate_kick_off_team(match, data.kick_off_team_id)
            self._validate_goal_prediction_fields(
                match=match,
                team1_score=values["team1_score"],
                team2_score=values["team2_score"],
                first_scoring_team_id=values.get("first_scoring_team_id"),
                first_goal_in=values.get("first_goal_in"),
            )
            if self._scores_have_no_goals(
                team1_score=values["team1_score"],
                team2_score=values["team2_score"],
            ):
                values["first_scoring_team_id"] = None
                values["first_goal_in"] = None

            existing_prediction = await self._prediction_repository.get_by_user_and_match(
                user_id=user_id,
                match_id=data.match_id,
            )
            if existing_prediction is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Prediction already exists for this match",
                )

            prediction = Prediction(
                user_id=user_id,
                **values,
            )
            created_prediction = await self._prediction_repository.create(prediction)
            return PredictionResponse.model_validate(created_prediction)
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during create_prediction", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not create prediction",
            )

    async def update_prediction(
        self,
        *,
        user_id: int,
        prediction_id: int,
        data: PredictionUpdate,
    ) -> PredictionResponse:
        """Update a user's prediction while prediction editing is open."""
        try:
            prediction = await self._get_user_prediction_or_404(
                prediction_id=prediction_id,
                user_id=user_id,
            )
            match = await self._get_match_or_404(prediction.match_id)
            self._ensure_prediction_is_open(match)

            values = data.model_dump(exclude_unset=True)
            if not values:
                return PredictionResponse.model_validate(prediction)

            kick_off_team_id = values.get("kick_off_team_id", prediction.kick_off_team_id)
            self._validate_kick_off_team(match, kick_off_team_id)
            team1_score = values.get("team1_score", prediction.team1_score)
            team2_score = values.get("team2_score", prediction.team2_score)
            first_scoring_team_id = values.get(
                "first_scoring_team_id",
                prediction.first_scoring_team_id,
            )
            first_goal_in = values.get(
                "first_goal_in",
                prediction.first_goal_in,
            )
            self._validate_goal_prediction_fields(
                match=match,
                team1_score=team1_score,
                team2_score=team2_score,
                first_scoring_team_id=first_scoring_team_id,
                first_goal_in=first_goal_in,
            )
            if self._scores_have_no_goals(
                team1_score=team1_score,
                team2_score=team2_score,
            ):
                values["first_scoring_team_id"] = None
                values["first_goal_in"] = None

            updated_prediction = await self._prediction_repository.update(
                prediction,
                values,
            )
            return PredictionResponse.model_validate(updated_prediction)
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during update_prediction", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not update prediction",
            )

    async def _get_match_or_404(self, match_id: int) -> Match:
        """Fetch a match or raise a 404."""
        try:
            match = await self._match_repository.get_by_id(match_id)
            if match is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Match not found",
                )
            return match
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during _get_match_or_404", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not read match",
            )

    async def _get_user_prediction_or_404(
        self,
        *,
        prediction_id: int,
        user_id: int,
    ) -> Prediction:
        """Fetch a user's prediction or raise a 404."""
        try:
            prediction = await self._prediction_repository.get_for_user(
                prediction_id=prediction_id,
                user_id=user_id,
            )
            if prediction is None:
                raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prediction not found",
            )
            return prediction
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during _get_user_prediction_or_404", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not read prediction",
            )

    @staticmethod
    def _ensure_prediction_is_open(match: Match) -> None:
        """Ensure a match is still open for prediction changes."""
        if match.match_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Prediction is locked for this match",
            )

        match_datetime = PredictionService._as_aware_utc(match.match_datetime)
        prediction_deadline = match_datetime - timedelta(hours=1)
        if datetime.now(timezone.utc) >= prediction_deadline:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Prediction deadline has passed for this match",
            )

    @staticmethod
    def _validate_kick_off_team(match: Match, kick_off_team_id: int) -> None:
        """Ensure kickoff team is one of the match participants."""
        if kick_off_team_id is not None and kick_off_team_id not in {match.team1_id, match.team2_id}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="kick_off_team_id must match one of the match teams",
            )

    @staticmethod
    def _validate_goal_prediction_fields(
        *,
        match: Match,
        team1_score: int,
        team2_score: int,
        first_scoring_team_id: int | None,
        first_goal_in: FirstGoalIn | None,
    ) -> None:
        """Validate fields that only apply when goals are predicted."""
        if team1_score + team2_score == 0:
            return

        # commented as null/empty values can be sent from frontend by dump users
        # if first_goal_in is None:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="first_goal_in is required when goals are predicted",
        #     )

        # if first_scoring_team_id is None:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="first_scoring_team_id is required when goals are predicted",
        #     )

        if first_scoring_team_id is not None and first_scoring_team_id not in {match.team1_id, match.team2_id}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_scoring_team_id must match one of the match teams",
            )

    @staticmethod
    def _scores_have_no_goals(*, team1_score: int, team2_score: int) -> bool:
        """Return whether the predicted score is goal-less."""
        return team1_score == 0 and team2_score == 0

    @staticmethod
    def _as_aware_utc(value: datetime) -> datetime:
        """Return a timezone-aware UTC datetime."""
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _build_list_response(
        *,
        predictions: list[Prediction],
        total: int,
        limit: int,
        offset: int,
    ) -> PredictionListResponse:
        """Build a paginated prediction response."""
        return PredictionListResponse(
            items=[
                PredictionResponse.model_validate(prediction)
                for prediction in predictions
            ],
            total=total,
            limit=limit,
            offset=offset,
        )
