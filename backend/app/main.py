"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.groups import router as groups_router
from app.api.home import router as home_router
from app.api.matches import admin_router as admin_matches_router
from app.api.matches import router as matches_router
from app.api.predictions import router as predictions_router
from app.api.settings import router as settings_router
from app.api.teams import router as teams_router
from app.api.users import admin_router as admin_users_router
from app.api.users import leaderboard_router
from app.api.users import router as users_router
from app.core.config import settings

app = FastAPI(
    title="Football Predictor API",
    version="1.0.0",
    description="Football Tournament Prediction Platform API",
)

# ── Middleware ───────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(groups_router)
app.include_router(home_router)
app.include_router(matches_router)
app.include_router(admin_matches_router)
app.include_router(predictions_router)
app.include_router(settings_router)
app.include_router(teams_router)
app.include_router(users_router)
app.include_router(leaderboard_router)
app.include_router(admin_users_router)


# ── Health Check ────────────────────────────────────────────────


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "healthy"}
