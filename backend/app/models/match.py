"""Match SQLAlchemy model."""

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.team import Team


class GameDuration(str, enum.Enum):
    """Possible durations / outcomes of a match."""

    REGULAR = "90"
    EXTRA_TIME = "120"
    PENALTY = "PENALTY"

class MatchStage(str, enum.Enum):
    """Possible stages of a football match."""

    GROUP = "GROUP"
    R32 = "R32"
    R16 = "R16"
    QF = "QF"
    SF = "SF"
    TP = "3P"
    F = "F"


def match_duration_values(enum_type: type[GameDuration]) -> list[str]:
    """Persist the public enum values instead of Python enum member names."""
    return [duration.value for duration in enum_type]


def match_stage_values(enum_type: type[MatchStage]) -> list[str]:
    """Persist the public enum values instead of Python enum member names."""
    return [stage.value for stage in enum_type]


class Match(TimestampMixin, Base):
    """SQLAlchemy model for the matches table.

    Fields derived from ARCHITEXTURE.md:
        id, team1_score, team2_score, yellow_card_count, red_card_count,
        kick_off_team_id, match_duration, match_datetime, match_locked,
        match_reminder_sent, match_day, venue

    Additional fields:
        team1_id     – FK to teams (implied by team1_score)
        team2_id     – FK to teams (implied by team2_score)
        created_at   – inherited from TimestampMixin
        updated_at   – inherited from TimestampMixin
    """

    __tablename__ = "matches"

    # ── Primary Key ──────────────────────────────────────────────
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ── Team References ──────────────────────────────────────────
    team1_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id"),
        nullable=False,
    )
    team2_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id"),
        nullable=False,
    )

    # ── Score Fields ─────────────────────────────────────────────
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

    # ── Match Statistics ─────────────────────────────────────────
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

    # ── Kick off Team ─────────────────────────────────────────────
    kick_off_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True,
        default=None,
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

    # ── Game Duration ────────────────────────────────────────────
    match_duration: Mapped[GameDuration | None] = mapped_column(
        Enum(
            GameDuration,
            name="match_duration",
            native_enum=False,
            length=10,
            values_callable=match_duration_values,
            validate_strings=True,
        ),
        nullable=True,
        default=None,
    )

    # ── Match Stage ────────────────────────────────────────────
    match_stage: Mapped[str | None] = mapped_column(
        Enum(
            MatchStage,
            name="match_stage",
            native_enum=False,
            length=20,
            values_callable=match_stage_values,
            validate_strings=True,
        ),
        nullable=True,
        default=None,
    )

    # ── Scheduling ───────────────────────────────────────────────
    match_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    match_day: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    venue_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        default=None,
    )

    # ── Status Flags ─────────────────────────────────────────────
    match_locked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    match_reminder_sent: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )

    # ── Relationships ────────────────────────────────────────────
    team1: Mapped["Team"] = relationship(
        "Team",
        foreign_keys=[team1_id],
        lazy="selectin",
    )
    team2: Mapped["Team"] = relationship(
        "Team",
        foreign_keys=[team2_id],
        lazy="selectin",
    )
    kick_off_team: Mapped["Team | None"] = relationship(
        "Team",
        foreign_keys=[kick_off_team_id],
        lazy="selectin",
    )
    first_scoring_team: Mapped["Team | None"] = relationship(
        "Team",
        foreign_keys=[first_scoring_team_id],
        lazy="selectin",
    )

    # ── Indexes ──────────────────────────────────────────────────
    __table_args__ = (
        CheckConstraint("team1_id <> team2_id", name="ck_matches_distinct_teams"),
        CheckConstraint(
            "team1_score IS NULL OR team1_score >= 0",
            name="ck_matches_team1_score_nonnegative",
        ),
        CheckConstraint(
            "team2_score IS NULL OR team2_score >= 0",
            name="ck_matches_team2_score_nonnegative",
        ),
        CheckConstraint(
            "yellow_card_count IS NULL OR yellow_card_count >= 0",
            name="ck_matches_yellow_card_count_nonnegative",
        ),
        CheckConstraint(
            "red_card_count IS NULL OR red_card_count >= 0",
            name="ck_matches_red_card_count_nonnegative",
        ),
        CheckConstraint("match_day > 0", name="ck_matches_match_day_positive"),
        CheckConstraint(
            "kick_off_team_id IS NULL "
            "OR kick_off_team_id = team1_id "
            "OR kick_off_team_id = team2_id",
            name="ck_matches_kick_off_team_participant",
        ),
        CheckConstraint(
            "first_scoring_team_id IS NULL "
            "OR first_scoring_team_id = team1_id "
            "OR first_scoring_team_id = team2_id",
            name="ck_matches_first_scoring_team_participant",
        ),
        Index("ix_matches_match_datetime", "match_datetime"),
        Index("ix_matches_match_day", "match_day"),
        Index("ix_matches_match_locked", "match_locked"),
        Index("ix_matches_locked_datetime", "match_locked", "match_datetime"),
        Index("ix_matches_team1_id", "team1_id"),
        Index("ix_matches_team2_id", "team2_id"),
        Index("ix_matches_kick_off_team_id", "kick_off_team_id"),
        Index("ix_matches_first_scoring_team_id", "first_scoring_team_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<Match(id={self.id}, team1_id={self.team1_id}, "
            f"team2_id={self.team2_id}, "
            f"match_datetime={self.match_datetime})>"
        )
