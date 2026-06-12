"""Home-page summary API routes."""

from app.api.deps import OptionalCurrentUser
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
    operation_id="get_home_summary",
)
async def get_home_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: OptionalCurrentUser = None,
) -> HomeSummaryResponse:
    """Return public home-page tournament stats."""
    service = HomeService(db)
    user_id = current_user.id if current_user else None
    return await service.get_summary(user_id)
