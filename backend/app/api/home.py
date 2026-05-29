"""Home-page summary API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.home import HomeSummaryResponse
from app.services.home_service import HomeService

router = APIRouter(prefix="/home", tags=["Home"])


@router.get(
    "/summary",
    response_model=HomeSummaryResponse,
    summary="Get home-page summary",
)
async def get_home_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HomeSummaryResponse:
    """Return public home-page tournament stats."""
    service = HomeService(db)
    return await service.get_summary()
