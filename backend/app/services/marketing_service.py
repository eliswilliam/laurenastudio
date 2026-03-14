"""
services/marketing_service.py
Marketing AI — prompt optimization and ad generation via Gemini + Veo.

Receives brand/ad data from the frontend, builds structured marketing prompts,
and delegates to the underlying AI models for high-quality ad creation.
Generation is fully based on the user's prompt — no hardcoded colour palettes.
"""
import asyncio
import base64
import logging
import time
import uuid
from functools import partial
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import settings
from app.services.ai_service import (
    GENERATED_DIR,
    VIDEOS_DIR,
    _get_client,
    _get_video_client,
)

logger = logging.getLogger(__name__)


# ── Prompt optimization ──────────────────────────────────────────────────────

def _build_image_prompt(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
) -> str:
    """Build an optimized prompt for advertising image generation."""
    base = (
        f"Create a professional, high-quality advertising image.\n\n"
        f"Brand: {brand_name}\n"
        f"Ad headline / copy: {ad_text}\n"
    )

    if user_prompt:
        base += f"Creative direction from the user: {user_prompt}\n"

    base += (
        "\nDesign requirements:\n"
        "- Modern, clean layout suitable for social-media ads\n"
        "- The brand name must appear prominently and be legible\n"
        "- The ad copy must be integrated clearly into the composition\n"
        "- Professional typography and strong visual hierarchy\n"
        "- Eye-catching, scroll-stopping composition\n"
        "- If a product or scene is depicted, make it look premium\n"
        "- Output a single finished ad creative — no mockup frames or device outlines\n"
        "- Choose the best colour palette and visual style based on the brand and prompt\n"
    )
    return base


def _build_video_prompt(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
    video_mode: str = "text_to_video",
) -> str:
    """Build an optimized prompt for advertising video generation."""
    base = (
        f"Create a professional advertising video.\n\n"
        f"Brand: {brand_name}\n"
        f"Ad message: {ad_text}\n"
    )

    if user_prompt:
        base += f"Creative direction: {user_prompt}\n"

    if video_mode == "image_to_video":
        base += (
            "\nThe provided image should be used as the starting visual. "
            "Animate it into a dynamic video that brings the scene to life.\n"
        )

    base += (
        "\nVideo requirements:\n"
        "- Open with an attention-grabbing visual hook in the first 2 seconds\n"
        f"- Display the brand name \"{brand_name}\" prominently\n"
        f"- Communicate the message: \"{ad_text}\"\n"
        "- Use smooth, professional transitions and motion\n"
        "- Modern, dynamic feel suitable for social media ads\n"
        "- End with a clear call-to-action moment\n"
        "- Cinematic quality, well-lit, visually polished\n"
        "- Choose the best colour palette and visual style based on the brand and prompt\n"
    )
    return base


# ── Gemini image config for marketing ────────────────────────────────────────

def _marketing_image_config() -> types.GenerateContentConfig:
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
        system_instruction=[
            types.Part.from_text(
                text=(
                    "You are a world-class advertising designer and creative director. "
                    "You create stunning, professional ad creatives that drive engagement "
                    "and conversions. Always output a finished advertising image with the "
                    "brand name and copy baked in. Follow the user's brief precisely. "
                    "Choose colours, style, and visual direction based solely on the user's prompt."
                )
            )
        ],
        image_config=types.ImageConfig(
            aspect_ratio="1:1",
            image_size="1K",
            output_mime_type="image/png",
        ),
    )


# ── Sync generation helpers (run in thread pool) ─────────────────────────────

def _sync_marketing_image(
    prompt: str,
    reference_image_bytes: bytes | None = None,
    reference_mime: str = "image/png",
) -> tuple[str, bytes | None, str]:
    """Blocking Gemini call for marketing image — supports optional reference image."""
    client = _get_client()
    config = _marketing_image_config()

    parts: list[types.Part] = []
    if reference_image_bytes:
        parts.append(
            types.Part.from_bytes(data=reference_image_bytes, mime_type=reference_mime)
        )
        parts.append(
            types.Part.from_text(
                text=(
                    "Use the attached image as the main visual reference for the ad. "
                    "Integrate it into a professional advertising layout.\n\n" + prompt
                )
            )
        )
    else:
        parts.append(types.Part.from_text(text=prompt))

    contents = [types.Content(role="user", parts=parts)]

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


def _sync_marketing_video(
    prompt: str,
    reference_image_bytes: bytes | None = None,
    reference_mime: str = "image/png",
) -> str:
    """Blocking Veo call for marketing video — supports text-to-video and image-to-video."""
    client = _get_video_client()

    if reference_image_bytes:
        source = types.GenerateVideosSource(
            image=types.Image(
                image_bytes=reference_image_bytes,
                mime_type=reference_mime,
            ),
            prompt=prompt,
        )
    else:
        source = types.GenerateVideosSource(prompt=prompt)

    config = types.GenerateVideosConfig(
        aspect_ratio="9:16",
        number_of_videos=1,
        duration_seconds=8,
        person_generation="allow_all",
        generate_audio=True,
    )

    logger.info("Marketing video generation started (has_image=%s): %s",
                reference_image_bytes is not None, prompt[:100])

    operation = client.models.generate_videos(
        model="veo-3.1-generate-001",
        source=source,
        config=config,
    )

    max_wait = 300
    elapsed = 0
    poll_interval = 10
    while not operation.done and elapsed < max_wait:
        logger.info("Video pending… %ds elapsed", elapsed)
        time.sleep(poll_interval)
        elapsed += poll_interval
        operation = client.operations.get(operation)

    if not operation.done:
        raise RuntimeError("Video generation timed out after 5 minutes.")

    response = operation.result
    if not response or not response.generated_videos:
        raise RuntimeError(
            "Video generation returned no result — the content may have been filtered. "
            "Try a different prompt."
        )

    video = response.generated_videos[0]
    if not video.video or not video.video.video_bytes:
        raise RuntimeError("Generated video has no data.")

    video_bytes = video.video.video_bytes
    filename = f"{uuid.uuid4().hex}.mp4"
    filepath = VIDEOS_DIR / filename
    filepath.write_bytes(video_bytes)
    logger.info("Saved marketing video: %s (%d bytes)", filename, len(video_bytes))
    return f"/uploads/videos/{filename}"


# ── Public async API ─────────────────────────────────────────────────────────

async def generate_marketing_image(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
    reference_image_b64: str | None = None,
    reference_mime: str = "image/png",
) -> dict:
    """Generate a marketing ad image. Returns dict with image_url and ai_text."""
    prompt = _build_image_prompt(brand_name, ad_text, user_prompt)
    logger.info("Marketing image prompt (%d chars): %s…", len(prompt), prompt[:120])

    ref_bytes: bytes | None = None
    if reference_image_b64:
        ref_bytes = base64.b64decode(reference_image_b64)

    loop = asyncio.get_running_loop()
    text, image_data, image_mime = await loop.run_in_executor(
        None,
        partial(_sync_marketing_image, prompt, ref_bytes, reference_mime),
    )

    image_url: str | None = None
    if image_data:
        ext = image_mime.split("/")[-1]
        if ext == "jpeg":
            ext = "jpg"
        if ext not in ("png", "jpg", "gif", "webp"):
            ext = "png"
        filename = f"mkt_{uuid.uuid4().hex}.{ext}"
        filepath = GENERATED_DIR / filename
        filepath.write_bytes(image_data)
        image_url = f"/uploads/generated/{filename}"
        logger.info("Saved marketing image: %s (%d bytes)", filename, len(image_data))

    return {"image_url": image_url, "ai_text": text.strip() if text else None}


async def generate_marketing_video(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
    video_mode: str = "text_to_video",
    reference_image_b64: str | None = None,
    reference_mime: str = "image/png",
) -> dict:
    """Generate a marketing ad video. Returns dict with video_url."""
    prompt = _build_video_prompt(brand_name, ad_text, user_prompt, video_mode)
    logger.info("Marketing video prompt (%d chars, mode=%s): %s…",
                len(prompt), video_mode, prompt[:120])

    ref_bytes: bytes | None = None
    if reference_image_b64 and video_mode == "image_to_video":
        ref_bytes = base64.b64decode(reference_image_b64)

    loop = asyncio.get_running_loop()
    video_url = await loop.run_in_executor(
        None, partial(_sync_marketing_video, prompt, ref_bytes, reference_mime)
    )

    return {"video_url": video_url}
