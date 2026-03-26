"""
services/ai_service.py
Google Gemini (text) + Replicate FLUX (image) + Replicate Minimax (video).
  - Text: Gemini (gemini-2.5-flash-image stream devolve texto; modelo de texto configurável)
  - Image: Replicate REPLICATE_IMAGE_MODEL (padrão black-forest-labs/flux-dev)
  - Video: Replicate Minimax (hailuo-2.3-fast)
"""
import asyncio
import logging
import os
import tempfile
import time
import uuid
from functools import partial
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.google_credentials import decode_google_service_account_json
from app.services.replicate_image_service import run_replicate_image

logger = logging.getLogger(__name__)

# Upload directories
GENERATED_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

VIDEOS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Client for Gemini text/image via the Gemini Developer API (AI Studio key).

    Use ``vertexai=False`` explicitly so ``GOOGLE_GENAI_USE_VERTEXAI`` in the
    environment cannot switch this to Vertex express mode, which interacts
    badly with ``GOOGLE_CLOUD_PROJECT``/location and API-key auth for chat.
    """
    global _client
    if _client is None:
        api_key = (settings.GOOGLE_CLOUD_API_KEY or settings.GOOGLE_API_KEY or "").strip()
        if not api_key:
            raise RuntimeError(
                "Set GOOGLE_API_KEY or GOOGLE_CLOUD_API_KEY for Gemini (site builder + marketing)."
            )
        _client = genai.Client(vertexai=False, api_key=api_key)
    return _client


def _build_config(
    *,
    style: str | None = None,
) -> types.GenerateContentConfig:
    """Build the GenerateContentConfig matching the reference app.py."""
    system_text = (
        "voce vai ajudar a criar anunciois pra marketimg, "
        "respondre baseado na linguagem do usuario"
    )
    if style:
        system_text += f"\nUse um tom {style}."

    return types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=32768,
        response_modalities=["TEXT", "IMAGE"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
        system_instruction=[types.Part.from_text(text=system_text)],
        image_config=types.ImageConfig(
            aspect_ratio="1:1",
            image_size="1K",
        ),
    )


def _sync_generate(prompt: str, *, style: str | None = None):
    """Blocking call to Gemini — run in a thread from async code."""
    client = _get_client()
    config = _build_config(style=style)

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ),
    ]

    text_parts: list[str] = []
    image_data: bytes | None = None
    image_mime: str = "image/png"

    for chunk in client.models.generate_content_stream(
        model="gemini-2.5-flash-image",
        contents=contents,
        config=config,
    ):
        if not chunk.candidates:
            continue
        for part in chunk.candidates[0].content.parts:
            if part.text:
                text_parts.append(part.text)
            elif part.inline_data and part.inline_data.data:
                image_data = part.inline_data.data
                image_mime = part.inline_data.mime_type or "image/png"

    return "".join(text_parts), image_data, image_mime


async def generate_text(
    prompt: str,
    *,
    model: str | None = None,
    style: str | None = None,
) -> str:
    """Generate text content via Gemini."""
    loop = asyncio.get_running_loop()
    text, _, _ = await loop.run_in_executor(
        None, partial(_sync_generate, prompt, style=style)
    )
    if not text.strip():
        raise RuntimeError("No text content in AI response.")
    return text


async def generate_image(
    prompt: str,
    *,
    model: str | None = None,
    style: str | None = None,
) -> str:
    """Gera imagem via Replicate (FLUX). Devolve URL relativa do ficheiro em /uploads/generated/."""
    loop = asyncio.get_running_loop()
    full_prompt = f"{prompt.strip()}. Estilo: {style}" if style else prompt.strip()

    def _run() -> bytes:
        return run_replicate_image(full_prompt, aspect_ratio="1:1")

    image_data = await loop.run_in_executor(None, _run)
    filename = f"{uuid.uuid4().hex}.webp"
    filepath = GENERATED_DIR / filename
    filepath.write_bytes(image_data)
    logger.info("Saved generated image (Replicate): %s (%d bytes)", filename, len(image_data))
    return f"/uploads/generated/{filename}"


# ── Video generation (Replicate Minimax) ───────────────────────────────────


def _sync_generate_video(prompt: str, *, style: str | None = None, reference_image_bytes: bytes | None = None) -> str:
    """Blocking call to Replicate — generates a video, saves to disk.
    Returns the relative URL path to the saved video file.
    """
    import replicate
    import os
    import io

    if not reference_image_bytes:
        raise ValueError("Veuillez ajouter une image pour générer la vidéo.")

    if not os.environ.get("REPLICATE_API_TOKEN"):
        logger.warning("REPLICATE_API_TOKEN is missing!")

    full_prompt = prompt
    if style:
        full_prompt = f"{prompt}. Style: {style}"

    logger.info("Starting Minimax video generation: prompt=%s", full_prompt[:80])

    inputs = {
        "prompt": full_prompt,
        "first_frame_image": io.BytesIO(reference_image_bytes)
    }

    try:
        output = replicate.run(
            "minimax/hailuo-2.3-fast",
            input=inputs
        )
        
        filename = f"{uuid.uuid4().hex}.mp4"
        filepath = VIDEOS_DIR / filename
        
        with open(filepath, "wb") as file:
            file.write(output.read())
            
        logger.info("Saved generated video: %s", filename)
        return f"/uploads/videos/{filename}"
    except Exception as e:
        logger.error("Video generation failed: %s", e)
        raise RuntimeError(f"Video generation failed: {e}")


async def generate_video(
    prompt: str,
    *,
    model: str | None = None,
    style: str | None = None,
    reference_image_bytes: bytes | None = None
) -> str:
    """Generate a video via Replicate Minimax. Returns relative URL to the saved file."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, partial(_sync_generate_video, prompt, style=style, reference_image_bytes=reference_image_bytes)
    )
