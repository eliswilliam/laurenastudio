"""
welcome_email_service.py — envoi du e-mail de bienvenue après première authentification réussie.
Ne bloque pas la réponse HTTP (appelé via FastAPI BackgroundTasks).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.plan import Plan
from app.models.user import User
from app.services.email_service import send_welcome_email

logger = logging.getLogger(__name__)


def _plan_tagline(plan_name: str) -> str:
    n = (plan_name or "").lower()
    if n == "starter":
        return "Ideal para começar: IA de texto e imagem, posts e redes sociais com limites generosos."
    if n == "pro":
        return "Para equipas em crescimento: mais créditos, mais redes e recursos avançados."
    if n == "business":
        return "Escala total: limites elevados ou ilimitados para marcas que produzem em volume."
    return "Descubra os limites no painel após escolher o plano."


async def _run_with_session(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = result.scalars().first()
    if not user:
        logger.warning("welcome email: user not found %s", user_id)
        return
    if user.welcome_email_sent_at is not None:
        return

    plans_result = await db.execute(select(Plan).order_by(Plan.price_brl.asc()))
    plans = plans_result.scalars().all()
    plan_rows: list[tuple[str, str, str, str]] = []
    for p in plans:
        price_num = float(p.price_brl)
        # Formato brasileiro: 29,90
        price_fmt = f"R$ {price_num:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        plan_rows.append(
            (p.display_name, price_fmt, p.name, _plan_tagline(p.name)),
        )

    display_name = (user.full_name or "").strip() or user.email.split("@")[0]

    try:
        sent = await send_welcome_email(
            to_email=user.email,
            recipient_name=display_name,
            plans=plan_rows,
        )
    except Exception:
        logger.exception("welcome email send failed user_id=%s", user_id)
        return

    if not sent:
        return

    user.welcome_email_sent_at = datetime.now(timezone.utc)
    await db.commit()


async def run_welcome_email_task(user_id: str) -> None:
    """Tâche async pour BackgroundTasks : envoie une seule fois (flag en base)."""
    try:
        async with AsyncSessionLocal() as db:
            try:
                await _run_with_session(db, user_id)
            except Exception:
                await db.rollback()
                raise
    except Exception:
        logger.exception("welcome email task failed user_id=%s", user_id)
