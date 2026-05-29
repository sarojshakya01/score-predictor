"""Team SQLAlchemy model."""

from sqlalchemy import CheckConstraint, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Team(TimestampMixin, Base):
    """SQLAlchemy model for the teams table."""

    __tablename__ = "teams"

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
    group: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    fifa_code: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("CHAR_LENGTH(name) > 0", name="ck_teams_name_not_empty"),
        CheckConstraint("CHAR_LENGTH(`group`) > 0", name="ck_teams_group_not_empty"),
        CheckConstraint(
            "CHAR_LENGTH(fifa_code) BETWEEN 2 AND 3",
            name="ck_teams_fifa_code_length",
        ),
        Index("ix_teams_group", "group"),
        Index("ix_teams_fifa_code", "fifa_code"),
    )

    def __repr__(self) -> str:
        return (
            f"<Team(id={self.id}, name='{self.name}', "
            f"group='{self.group}', fifa_code='{self.fifa_code}')>"
        )
