"""
Azure Cognitive Services — speech synthesis (text to WAV in memory).
"""
from __future__ import annotations

import logging

import azure.cognitiveservices.speech as speechsdk

from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_endpoint(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return u
    return u if u.endswith("/") else u + "/"


def synthesize_speech_wav(text: str, voice_name: str | None = None) -> bytes:
    """
    Synthesize UTF-8 text to a WAV (RIFF) byte string.
    Raises RuntimeError if Azure is not configured or synthesis fails.
    """
    key = (settings.AZURE_SPEECH_KEY or "").strip()
    endpoint = _normalize_endpoint(settings.AZURE_SPEECH_ENDPOINT or "")
    if not key or not endpoint:
        raise RuntimeError(
            "Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_ENDPOINT."
        )

    voice = (voice_name or settings.AZURE_SPEECH_VOICE or "").strip()
    if not voice:
        voice = "en-US-Ava:DragonHDLatestNeural"

    speech_config = speechsdk.SpeechConfig(subscription=key, endpoint=endpoint)
    speech_config.speech_synthesis_voice_name = voice
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
    )

    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config, audio_config=None
    )
    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        audio = result.audio_data
        if not audio:
            raise RuntimeError("Speech synthesis returned empty audio.")
        return audio

    if result.reason == speechsdk.ResultReason.Canceled:
        err = "Speech synthesis canceled"
        details = result.cancellation_details
        if details:
            err = f"{err}: {details.reason}"
            if details.reason == speechsdk.CancellationReason.Error and details.error_details:
                err = f"{err} — {details.error_details}"
        logger.warning("Azure Speech canceled: %s", err)
        raise RuntimeError(err)

    raise RuntimeError(f"Unexpected synthesis result: {result.reason}")
