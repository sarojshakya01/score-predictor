"""Prediction SQLAlchemy model."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
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
from app.models.match import GameDuration, game_duration_values


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

    team1_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    team2_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    yellow_card_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    red_card_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    opening_team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id"),
        nullable=False,
    )
    first_scoring_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True,
        default=None,
    )
    is_goal_in_first_half: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
        default=None,
    )
    game_duration: Mapped[GameDuration] = mapped_column(
        Enum(
            GameDuration,
            name="game_duration",
            native_enum=False,
            length=10,
            values_callable=game_duration_values,
            validate_strings=True,
        ),
        nullable=False,
    )

    predicted_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
    match: Mapped["Match"] = relationship(  # noqa: F821
        "Match",
        foreign_keys=[match_id],
        lazy="selectin",
    )
    opening_team: Mapped["Team"] = relationship(  # noqa: F821
        "Team",
        foreign_keys=[opening_team_id],
        lazy="selectin",
    )
    first_scoring_team: Mapped["Team | None"] = relationship(  # noqa: F821
        "Team",
        foreign_keys=[first_scoring_team_id],
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_predictions_user_match"),
        CheckConstraint(
            "team1_score >= 0",
            name="ck_predictions_team1_score_nonnegative",
        ),
        CheckConstraint(
            "team2_score >= 0",
            name="ck_predictions_team2_score_nonnegative",
        ),
        CheckConstraint(
            "yellow_card_count >= 0",
            name="ck_predictions_yellow_card_count_nonnegative",
        ),
        CheckConstraint(
            "red_card_count >= 0",
            name="ck_predictions_red_card_count_nonnegative",
        ),
        Index("ix_predictions_user_id", "user_id"),
        Index("ix_predictions_match_id", "match_id"),
        Index("ix_predictions_opening_team_id", "opening_team_id"),
        Index("ix_predictions_first_scoring_team_id", "first_scoring_team_id"),
        Index("ix_predictions_predicted_datetime", "predicted_datetime"),
    )

    def __repr__(self) -> str:
        return (
            f"<Prediction(id={self.id}, user_id={self.user_id}, "
            f"match_id={self.match_id})>"
        )
