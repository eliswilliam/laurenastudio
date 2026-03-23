"""Create and query in-app notifications (PT-BR copy)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_notification import UserNotification
from app.models.workspace import Workspace
from app.schemas.notification import NotificationRead

logger = logging.getLogger(__name__)


async def workspace_owner_id(db: AsyncSession, workspace_id: str) -> str | None:
    r = await db.execute(select(Workspace.owner_id).where(Workspace.id == workspace_id))
    return r.scalar_one_or_none()


async def create_user_notification(
    db: AsyncSession,
    *,
    user_id: str,
    kind: str,
    title: str,
    body: str,
    link: str | None = None,
) -> UserNotification:
    row = UserNotification(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        link=link,
        read=False,
    )
    db.add(row)
    await db.flush()
    return row


async def list_notifications(
    db: AsyncSession,
    user_id: str,
    *,
    limit: int = 50,
) -> tuple[list[UserNotification], int]:
    q = (
        select(UserNotification)
        .where(UserNotification.user_id == user_id)
        .order_by(desc(UserNotification.created_at))
        .limit(min(limit, 100))
    )
    r = await db.execute(q)
    items = list(r.scalars().all())

    cnt_r = await db.execute(
        select(func.count())
        .select_from(UserNotification)
        .where(UserNotification.user_id == user_id, UserNotification.read.is_(False))
    )
    unread = int(cnt_r.scalar_one() or 0)
    return items, unread


def to_read(n: UserNotification) -> NotificationRead:
    return NotificationRead(
        id=n.id,
        kind=n.kind,
        title=n.title,
        body=n.body,
        link=n.link,
        read=n.read,
        created_at=n.created_at.isoformat() if n.created_at else datetime.now(timezone.utc).isoformat(),
    )


async def mark_notification_read(db: AsyncSession, user_id: str, notification_id: str) -> bool:
    r = await db.execute(
        select(UserNotification).where(
            UserNotification.id == notification_id,
            UserNotification.user_id == user_id,
        )
    )
    row = r.scalars().first()
    if not row:
        return False
    row.read = True
    await db.flush()
    return True


async def mark_all_read(db: AsyncSession, user_id: str) -> None:
    r = await db.execute(select(UserNotification).where(UserNotification.user_id == user_id, UserNotification.read.is_(False)))
    for row in r.scalars().all():
        row.read = True
    await db.flush()


async def list_notifications_newer_than(
    db: AsyncSession,
    user_id: str,
    after_id: str | None,
    limit: int = 20,
) -> list[UserNotification]:
    """Notifications with id greater than after_id (UUID string compare works for same version)."""
    q = select(UserNotification).where(UserNotification.user_id == user_id)
    if after_id:
        # Fetch rows created after the row with after_id
        ref = await db.execute(select(UserNotification).where(UserNotification.id == after_id, UserNotification.user_id == user_id))
        ref_row = ref.scalars().first()
        if ref_row and ref_row.created_at:
            q = q.where(UserNotification.created_at > ref_row.created_at)
    q = q.order_by(UserNotification.created_at.asc()).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


async def list_notifications_created_after(
    db: AsyncSession,
    user_id: str,
    after_time: datetime,
    limit: int = 30,
) -> list[UserNotification]:
    r = await db.execute(
        select(UserNotification)
        .where(UserNotification.user_id == user_id, UserNotification.created_at > after_time)
        .order_by(UserNotification.created_at.asc())
        .limit(limit)
    )
    return list(r.scalars().all())
