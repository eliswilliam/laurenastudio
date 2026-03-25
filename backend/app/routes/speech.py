"""
routes/speech.py
Azure Speech text-to-speech — subscription + monthly audio quota.
"""
import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    check_and_increment_usage,
    get_workspace_id,
    verify_active_subscription,
)
from app.db.session import get_db
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.speech import SpeechSynthesizeRequest
from app.services.speech_service import synthesize_speech_wav

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/speech", tags=["Speech"])


@router.post(
    "/synthesize",
    summary="Synthesize speech (Azure TTS)",
    description=(
        "Requires active subscription. Counts against monthly audio quota. "
        "Returns WAV audio (RIFF 16 kHz mono PCM)."
    ),
    response_class=Response,
)
async def synthesize_speech(
    payload: SpeechSynthesizeRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    # Persist usage (session commits on successful exit via get_db)
    await check_and_increment_usage(db, workspace_id, "audio", subscription)

    try:
        audio_bytes = await asyncio.to_thread(
            synthesize_speech_wav, payload.text, payload.voice_name
        )
    except RuntimeError as e:
        logger.exception("Speech synthesis failed for user=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        ) from e

    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": 'inline; filename="speech.wav"',
            "Cache-Control": "no-store",
        },
    )
