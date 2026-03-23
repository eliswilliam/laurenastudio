"""
routes/notifications.py
In-app notifications + SSE stream (polling) for near real-time updates.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import AsyncSessionLocal, get_db
from app.models.user_notification import UserNotification
from app.routes.auth import get_current_user
from app.schemas.notification import NotificationListResponse, NotificationRead
from app.services import notification_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _user_id_from_token(token: str) -> str:
    try:
        payload = decode_token(token)
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado.") from e
    uid = payload.get("sub", "")
    ttype = payload.get("type", "")
    if not uid or ttype != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")
    return uid


@router.get(
    "/",
    response_model=NotificationListResponse,
    summary="List notifications for current user",
)
async def list_my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
) -> NotificationListResponse:
    rows, unread = await notification_service.list_notifications(db, current_user.id, limit=limit)
    items = [notification_service.to_read(r) for r in rows]
    return NotificationListResponse(items=items, unread_count=unread)


@router.patch(
    "/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark one notification as read",
)
async def mark_one_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> None:
    ok = await notification_service.mark_notification_read(db, current_user.id, notification_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notificação não encontrada.")


@router.post(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all notifications as read",
)
async def mark_all_read_route(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> None:
    await notification_service.mark_all_read(db, current_user.id)


@router.get(
    "/stream",
    summary="SSE stream of new notifications (polling)",
)
async def notification_stream(
    token: str = Query(..., description="JWT access token"),
):
    """
    Server-Sent Events: every ~2s polls for rows created after connection time.
    Client: EventSource(`/api/v1/notifications/stream?token=...`).

    Note: EventSource cannot send Authorization headers — token is passed in query.
    """
    user_id = _user_id_from_token(token)
    connected_at = datetime.now(timezone.utc)
    emitted: set[str] = set()

    async def event_generator():
        try:
            while True:
                await asyncio.sleep(2)
                async with AsyncSessionLocal() as db:
                    try:
                        r = await db.execute(
                            select(UserNotification)
                            .where(
                                UserNotification.user_id == user_id,
                                UserNotification.created_at >= connected_at,
                            )
                            .order_by(UserNotification.created_at.asc())
                        )
                        for row in r.scalars().all():
                            if row.id in emitted:
                                continue
                            emitted.add(row.id)
                            data = notification_service.to_read(row).model_dump()
                            yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                    except (ProgrammingError, OperationalError) as e:
                        logger.warning("notification stream query skipped: %s", e)
                        yield ": keepalive\n\n"
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("notification stream ended: %s", e)

    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
