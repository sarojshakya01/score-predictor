"""Setting SQLAlchemy model."""

from sqlalchemy import CheckConstraint, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Setting(TimestampMixin, Base):
    """SQLAlchemy model for the settings table."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    friendly_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    value: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("CHAR_LENGTH(name) > 0", name="ck_settings_name_not_empty"),
        CheckConstraint(
            "CHAR_LENGTH(friendly_name) > 0",
            name="ck_settings_friendly_name_not_empty",
        ),
    )

    def __repr__(self) -> str:
        return f"<Setting(id={self.id}, name='{self.name}')>"
