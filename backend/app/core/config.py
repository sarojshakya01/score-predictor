"""Application configuration loaded from environment variables."""

from pydantic_settings import SettingsConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Global application settings.

    Values are loaded from environment variables or a .env file
    located in the backend root directory.
    """

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = "mysql+aiomysql://root:@localhost:3306/worldcup2026"

    # ── JWT ──────────────────────────────────────────────────────
    JWT_SECRET: str = "wc2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_MINUTES: int = 10080  # 7 days

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
