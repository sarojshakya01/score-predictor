"""Setting SQLAlchemy model."""

from sqlalchemy import CheckConstraint, String, Text
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
    value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("CHAR_LENGTH(name) > 0", name="ck_settings_name_not_empty"),
        CheckConstraint(
            "CHAR_LENGTH(`value`) > 0",
            name="ck_settings_value_not_empty",
        ),
    )

    def __repr__(self) -> str:
        return f"<Setting(id={self.id}, name='{self.name}')>"
