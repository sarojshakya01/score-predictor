"""Repository for prediction database operations."""

from collections.abc import Mapping
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.models.match import Match
from app.models.prediction import Prediction
from app.models.user import User, UserRole


class PredictionRepository:
    """Encapsulates all database operations for the Prediction model."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, prediction_id: int) -> Prediction | None:
        """Fetch a prediction by primary key."""
        result = await self._db.execute(
            select(Prediction).where(Prediction.id == prediction_id),
        )
        return result.scalar_one_or_none()

    async def get_for_user(
        self,
        *,
        prediction_id: int,
        user_id: int,
    ) -> Prediction | None:
        """Fetch a prediction by id scoped to a user."""
        result = await self._db.execute(
            select(Prediction).where(
                Prediction.id == prediction_id,
                Prediction.user_id == user_id,
            ),
        )
        return result.scalar_one_or_none()

    async def get_by_user_and_match(
        self,
        *,
        user_id: int,
        match_id: int,
    ) -> Prediction | None:
        """Fetch a user's prediction for a specific match."""
        result = await self._db.execute(
            select(Prediction).where(
                Prediction.user_id == user_id,
                Prediction.match_id == match_id,
            ),
        )
        return result.scalar_one_or_none()

    async def list_predictions(
        self,
        *,
        offset: int = 0,
        limit: int = 500,
        user_id: int | None = None,
        match_id: int | None = None,
    ) -> list[Prediction]:
        """Fetch predictions with optional filters and pagination."""
        statement = select(Prediction)

        if user_id is not None:
            statement = statement.where(Prediction.user_id == user_id)

        if match_id is not None:
            statement = statement.where(Prediction.match_id == match_id)

        result = await self._db.execute(
            statement.order_by(
                Prediction.predicted_datetime.desc(),
                Prediction.id.desc(),
            )
            .offset(offset)
            .limit(limit),
        )
        return list(result.scalars().all())

    async def count_predictions(
        self,
        *,
        user_id: int | None = None,
        match_id: int | None = None,
    ) -> int:
        """Count predictions using the same filters as list_predictions."""
        statement = select(func.count()).select_from(Prediction)

        if user_id is not None:
            statement = statement.where(Prediction.user_id == user_id)

        if match_id is not None:
            statement = statement.where(Prediction.match_id == match_id)

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def count_all_predictions(self, user_id: int = None) -> int:
        """Count every prediction in the system."""
        if user_id is None:
            statement = select(func.count()).select_from(Prediction)
        else:
            statement = select(func.count()).select_from(Prediction).where(Prediction.user_id == user_id)
        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def list_points_from_predictions_of_user(self, current_user: CurrentUser, user_id: int, current_match_day: int | None, locked_matches: list[Match]) -> list[Prediction]:
        """Fetch scored predictions for a specific user where the match has a final score."""

        current_match_day = current_match_day if current_match_day is not None else locked_matches[-1].match_day

        statement = (
            select(Prediction)
            .join(Prediction.match)
            .join(Prediction.user)
            .options(
                selectinload(Prediction.match),
                selectinload(Prediction.user),
            )
            .where(Prediction.user_id == user_id)
        )

        if current_user.id != user_id:
            statement = statement.where(Match.match_day <= current_match_day)
        
        statement = statement.order_by(Prediction.match_id.asc())

        result = await self._db.execute(statement)

        final_result = list(result.scalars().all())

        # hide other users' predictions if the match is not locked
        for idx, prediction in enumerate(final_result):
            if current_user.id != user_id and not prediction.match.match_locked:
                prediction = self.to_dummy_prediction_for_match(user_id, prediction.match)
                final_result[idx] = prediction

        # if prediction is not made for a locked match, add dummy prediction
        for locked_match in locked_matches:
            if locked_match.id not in [p.match_id for p in final_result]:
                prediction = self.to_dummy_prediction_for_match(user_id, locked_match)
                final_result.append(prediction)

        final_result.sort(key=lambda x: x.match_id, reverse=True)

        return final_result

    async def list_predictions_for_match(self, match_id: int) -> list[Prediction]:
        """Fetch active users' predictions for one match with display relationships."""
        statement = (
            select(Prediction)
            .join(Prediction.user)
            .options(
                selectinload(Prediction.user),
                selectinload(Prediction.kick_off_team),
                selectinload(Prediction.first_scoring_team),
            )
            .where(Prediction.match_id == match_id)
            .where(User.is_active.is_(True))
            .where(User.role == UserRole.USER)
            .order_by(User.created_at.asc(), User.id.asc())
        )

        result = await self._db.execute(statement)
        return list(result.scalars().all())


    async def list_scored_predictions(self) -> list[Prediction]:
        """Fetch predictions for active users where the match has a final score."""
        statement = (
            select(Prediction)
            .join(Prediction.match)
            .join(Prediction.user)
            .options(
                selectinload(Prediction.match),
                selectinload(Prediction.user),
            )
            .where(User.is_active.is_(True))
            .where(Match.team1_score.is_not(None))
            .where(Match.team2_score.is_not(None))
            .order_by(Prediction.user_id.asc(), Prediction.match_id.asc())
        )

        result = await self._db.execute(statement)
        return list(result.scalars().all())

    async def count_predictions_by_active_user(self) -> dict[int, int]:
        """Count all predictions made by each active user."""
        statement = (
            select(Prediction.user_id, func.count(Prediction.id))
            .join(Prediction.user)
            .where(User.is_active.is_(True))
            .group_by(Prediction.user_id)
        )

        result = await self._db.execute(statement)
        return {user_id: int(count) for user_id, count in result.all()}

    async def count_completed_match_predictions_by_active_user(self) -> dict[int, int]:
        """Count all predictions made by each active user."""
        statement = (
            select(Prediction.user_id, func.count(Prediction.id))
            .join(Prediction.user)
            .join(Match)
            .where(User.is_active.is_(True))
            .where(Match.match_locked.is_(True))
            .where(Match.match_datetime < datetime.utcnow())
            .group_by(Prediction.user_id)
        )

        result = await self._db.execute(statement)
        return {user_id: int(count) for user_id, count in result.all()}

    async def create(self, prediction: Prediction) -> Prediction:
        """Persist a new prediction and return the refreshed instance."""
        self._db.add(prediction)
        await self._db.commit()
        await self._db.refresh(prediction)
        return prediction

    async def update(
        self,
        prediction: Prediction,
        values: Mapping[str, object],
    ) -> Prediction:
        """Update an existing prediction and return the refreshed instance."""
        for field_name, value in values.items():
            setattr(prediction, field_name, value)

        await self._db.commit()
        await self._db.refresh(prediction)
        return prediction

    async def delete(self, prediction: Prediction) -> None:
        """Delete an existing prediction."""
        await self._db.delete(prediction)
        await self._db.commit()

    @staticmethod
    def to_dummy_prediction_for_match(user_id: int, match: Match) -> Prediction:
        """Returns a dummy prediction of the user for a given match."""
        return Prediction(
            id=None,
            user_id=user_id,
            match_id=match.id,
            team1_score=None,
            team2_score=None,
            yellow_card_count=None,
            red_card_count=None,
            first_goal_in=None,
            first_scoring_team_id=None,
            kick_off_team_id=None,
            match_duration=None,

            match=match
        )
