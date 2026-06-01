"""User SQLAlchemy model."""

import enum

from sqlalchemy import Boolean, Enum, Index, String
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

    # ── Indexes ──────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_is_active", "is_active"),
    )

    def __repr__(self) -> str:
        return (
            f"<User(id={self.id}, email='{self.email}', "
            f"role={self.role.value})>"
        )
