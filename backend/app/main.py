"""FastAPI application entry point."""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.home import router as home_router
from app.api.matches import admin_router as admin_matches_router
from app.api.matches import router as matches_router
from app.api.predictions import router as predictions_router
from app.api.settings import admin_router as admin_settings_router
from app.api.settings import router as settings_router
from app.api.teams import admin_router as admin_teams_router
from app.api.teams import group_router
from app.api.teams import router as teams_router
from app.api.users import admin_router as admin_users_router
from app.api.users import leaderboard_router
from app.api.users import router as users_router
from app.core.config import settings
from app.workers.scheduler import lifespan

app = FastAPI(
    title="Match Predictor API",
    version="1.0.0",
    description="Football Match Tournament Prediction Platform API",
    lifespan=lifespan,
    port=settings.PORT or 8025,
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
api_router = APIRouter(prefix=settings.API_BASE_PATH)

api_router.include_router(auth_router)
api_router.include_router(home_router)
api_router.include_router(matches_router)
api_router.include_router(admin_matches_router)
api_router.include_router(predictions_router)
api_router.include_router(settings_router)
api_router.include_router(admin_settings_router)
api_router.include_router(group_router)
api_router.include_router(teams_router)
api_router.include_router(admin_teams_router)
api_router.include_router(users_router)
api_router.include_router(leaderboard_router)
api_router.include_router(admin_users_router)

app.include_router(api_router)

# ── Health Check ────────────────────────────────────────────────


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "healthy"}
