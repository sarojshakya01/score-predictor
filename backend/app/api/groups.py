"""Group standings API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.group import GroupTableListResponse
from app.services.group_service import GroupService

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.get(
    "",
    response_model=GroupTableListResponse,
    summary="List group standings",
)
async def list_group_tables(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupTableListResponse:
    """Return group-stage standings for the public groups page."""
    service = GroupService(db)
    return await service.list_group_tables()
