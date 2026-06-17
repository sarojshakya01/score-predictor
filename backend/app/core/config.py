"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global application settings.

    Values are loaded from environment variables or a .env file
    located in the backend root directory.
    """

    APP_ROOT_PATH: str = ""

    # ── App Port ─────────────────────────────────────────────────
    PORT: int = 8025

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = ""

    # ── JWT ──────────────────────────────────────────────────────
    JWT_SECRET: str = "wc2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_MINUTES: int = 10080  # 7 days
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 1440  # 24 hours
    PASSWORD_RESET_EXPIRE_MINUTES: int = 60
    TIMEZONE: str = "Asia/Kathmandu"
    LIVE_MATH_UPDATE_INTERVAL_MIN: int = 1
    MATCH_LOCK_CHECK_INTERVAL_MIN: int = 5
    REMINDER_CHECK_INTERVAL_MIN: int = 30
    MATCH_DAY_UPDATE_TIME_HR: int = 0
    TODAYS_MATCH_REMINDER_TIME_HR: int = 10

    # ── EMAIL ───────────────────────────────────────────────────
    ADMIN_EMAIL: str = "[ADMIN_EMAIL]"
    EMAIL_FROM: str = "[EMAIL_ADDRESS]"
    EMAIL_PASS: str = "[PASSWORD]"
    EMAIL_SMTP: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    SITE_URL: str = "http://localhost:8026/"

    API_BASE_PATH: str = "/api/v1"

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:8025", "http://localhost:8026"]

    OPENAI_ENDPOINT: str = ""
    OPENAI_DEPLOYMENT_NAME: str = ""
    OPENAI_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

settings = Settings()
