"""
routes/search.py
Global search endpoint — searches across posts, media, campaigns, social accounts, and pages.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_workspace_id
from app.db.session import get_db
from app.routes.auth import get_current_user
from app.services import search_service

router = APIRouter(prefix="/search", tags=["Search"])


@router.get(
    "",
    summary="Global search",
    description=(
        "Searches posts, media, campaigns, social accounts, and system pages. "
        "Returns results grouped by type."
    ),
)
async def global_search(
    q: str = Query(..., min_length=1, max_length=200),
    workspace_id: str = Depends(get_workspace_id),
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await search_service.global_search(db, workspace_id, q)
