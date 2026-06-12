"""Prediction SQLAlchemy model."""

from app.models.user import User
from app.models.match import Match
from app.models.team import Team
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.match import MatchDuration, match_duration_values, FirstGoalIn, first_goal_in_values


class Prediction(TimestampMixin, Base):
    """SQLAlchemy model for the predictions table."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id"),
        nullable=False,
    )

    team1_score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )
    team2_score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )
    yellow_card_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )
    red_card_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )

    first_goal_in: Mapped[FirstGoalIn | None] = mapped_column(
        Enum(
            FirstGoalIn,
            name="first_goal_in",
            native_enum=False,
            length=20,
            values_callable=first_goal_in_values,
            validate_strings=True,
        ),
        nullable=True,
        default=None,
    )

    first_scoring_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True,
        default=None,
    )

    kick_off_team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True,
        default=None,
    )

    match_duration: Mapped[MatchDuration] = mapped_column(
        Enum(
            MatchDuration,
            name="match_duration",
            native_enum=False,
            length=10,
            values_callable=match_duration_values,
            validate_strings=True,
        ),
        nullable=True,
        default=None,
    )

    predicted_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
    match: Mapped["Match"] = relationship(
        "Match",
        foreign_keys=[match_id],
        lazy="selectin",
    )
    kick_off_team: Mapped["Team"] = relationship(
        "Team",
        foreign_keys=[kick_off_team_id],
        lazy="selectin",
    )
    first_scoring_team: Mapped["Team | None"] = relationship(
        "Team",
        foreign_keys=[first_scoring_team_id],
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_predictions_user_match"),
        CheckConstraint(
            "team1_score IS NULL OR team1_score >= 0",
            name="ck_predictions_team1_score_nonnegative",
        ),
        CheckConstraint(
            "team2_score IS NULL OR team2_score >= 0",
            name="ck_predictions_team2_score_nonnegative",
        ),
        CheckConstraint(
            "yellow_card_count IS NULL OR yellow_card_count >= 0",
            name="ck_predictions_yellow_card_count_nonnegative",
        ),
        CheckConstraint(
            "red_card_count IS NULL OR red_card_count >= 0",
            name="ck_predictions_red_card_count_nonnegative",
        ),
        Index("ix_predictions_user_id", "user_id"),
        Index("ix_predictions_match_id", "match_id"),
        Index("ix_predictions_kick_off_team_id", "kick_off_team_id"),
        Index("ix_predictions_first_scoring_team_id", "first_scoring_team_id"),
        Index("ix_predictions_predicted_datetime", "predicted_datetime"),
    )

    def __repr__(self) -> str:
        return (
            f"<Prediction(id={self.id}, user_id={self.user_id}, "
            f"match_id={self.match_id})>"
        )
