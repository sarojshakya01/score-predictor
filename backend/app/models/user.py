"""User SQLAlchemy model."""

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    """Enumeration of user roles in the system."""

    ADMIN = "ADMIN"
    USER = "USER"


class User(TimestampMixin, Base):
    """SQLAlchemy model for the users table."""

    __tablename__ = "users"

    # ── Primary Key ──────────────────────────────────────────────
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ── Identity Fields ──────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    middle_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    mobile_no: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # ── Authentication ───────────────────────────────────────────
    password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    email_verification_token_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    password_reset_token_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    # ── Authorization ────────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=False, length=10),
        nullable=False,
        default=UserRole.USER,
        server_default=UserRole.USER.value,
    )

    # ── Status ───────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    # ── Tournament Winner Predictions ───────────────────────────
    winner_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True,
        default=None,
    )
    runner_up_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True,
        default=None,
    )
    third_place_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True,
        default=None,
    )

    # ── Indexes ──────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_is_active", "is_active"),
        Index("ix_users_email_verification_token_hash", "email_verification_token_hash"),
        Index("ix_users_password_reset_token_hash", "password_reset_token_hash"),
        Index("ix_users_winner_team_id", "winner_team_id"),
        Index("ix_users_runner_up_team_id", "runner_up_team_id"),
        Index("ix_users_third_place_team_id", "third_place_team_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<User(id={self.id}, email='{self.email}', "
            f"role={self.role.value})>"
        )
