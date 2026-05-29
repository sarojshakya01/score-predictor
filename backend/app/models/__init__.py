"""SQLAlchemy models package."""

from app.models.match import GameDuration, Match
from app.models.prediction import Prediction
from app.models.setting import Setting
from app.models.team import Team
from app.models.user import User, UserRole

__all__: list[str] = [
    "GameDuration",
    "Match",
    "Prediction",
    "Setting",
    "Team",
    "User",
    "UserRole",
]
