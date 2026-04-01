"""
services/marketing_service.py
Marketing AI — imagens via Gemini image API (com fallback Pexels);
vídeos via Replicate (Minimax).
"""
import asyncio
import base64
import logging
import os
import time
import uuid
from functools import partial
import replicate

from app.services.ai_service import (
    GENERATED_DIR,
    VIDEOS_DIR,
)
from app.services.replicate_image_service import run_replicate_image

logger = logging.getLogger(__name__)


# â”€â”€ Prompt optimization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _clean(value: str | None) -> str:
    return (value or "").strip()

def _build_image_prompt(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
) -> str:
    """Build a structured prompt for advertising image generation."""
    brand = _clean(brand_name)
    copy = _clean(ad_text)
    direction = _clean(user_prompt)

    parts = [
        "You are an expert ad creative director and visual designer.",
        "Task: create one final social ad image (no mockup, no device frame).",
        "",
        f"Brand: {brand}",
        f"Core message: {copy}",
    ]

    if direction:
        parts += ["", f"Creative direction from user: {direction}"]

    parts += [
        "",
        "Creative goals:",
        "- Scroll-stopping composition with a clear focal point.",
        "- Brand readability: brand name must be clearly visible.",
        "- Copy readability: text must be short, legible and integrated naturally.",
        "- Visual hierarchy: focal visual > headline > support details > CTA.",
        "- Premium, modern ad style suitable for paid social.",
        "",
        "Output constraints:",
        "- 1:1 ad creative.",
        "- High contrast and mobile-first readability.",
        "- Avoid clutter, tiny text, watermark, logos of other brands.",
        "- Return only the final ad image.",
    ]
    return "\n".join(parts)


def _build_video_prompt(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
    video_mode: str = "text_to_video",
) -> str:
    """Build a structured prompt for advertising video generation."""
    brand = _clean(brand_name)
    copy = _clean(ad_text)
    direction = _clean(user_prompt)

    parts = [
        "You are an expert ad film director for short-form social video.",
        "Task: create one high-converting ad video for social platforms.",
        "",
        f"Brand: {brand}",
        f"Core message: {copy}",
        "Duration target: 6-12 seconds.",
        "Format: vertical-friendly composition, mobile-first legibility.",
    ]

    if direction:
        parts += ["", f"Creative direction from user: {direction}"]

    if video_mode == "image_to_video":
        parts += [
            "",
            "Use the provided image as first frame and preserve identity continuity.",
            "Animate naturally with smooth, realistic motion.",
        ]

    parts += [
        "",
        "Storyboard constraints:",
        "- 0-2s: strong visual hook.",
        "- Mid: demonstrate offer/value clearly.",
        "- End: clear CTA beat.",
        "- Keep brand readable on-screen.",
        "- Cinematic but clean; avoid over-effects and visual noise.",
        "",
        "Safety/output constraints:",
        "- No unrelated logos/brands.",
        "- No unreadable tiny text.",
        "- Return only the final video.",
    ]
    return "\n".join(parts)


# â”€â”€ Sync generation helpers (run in thread pool) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _sync_marketing_image(
    prompt: str,
    reference_image_bytes: bytes | None = None,
    reference_mime: str = "image/png",
) -> tuple[str, bytes | None, str]:
    """Imagem publicitária via Gemini image model (text-to-image / image-to-image)."""
    image_data = run_replicate_image(
        prompt,
        aspect_ratio="1:1",
        image_bytes=reference_image_bytes,
        reference_mime=reference_mime,
    )
    return "", image_data, "image/webp"


def _sync_marketing_video(
    prompt: str,
    reference_image_bytes: bytes | None = None,
    reference_mime: str = "image/png",
) -> str:
    """Blocking Replicate call for marketing video (Minimax hailuo-2.3-fast)."""

    if not reference_image_bytes:
        raise ValueError("Veuillez ajouter une image pour générer la vidéo.")

    import io
    if not os.environ.get("REPLICATE_API_TOKEN"):
        logger.warning("REPLICATE_API_TOKEN is missing!")

    inputs = {
        "prompt": prompt,
        "first_frame_image": io.BytesIO(reference_image_bytes),
    }

    logger.info("Marketing video generation started: prompt=%s", prompt[:100])

    try:
        output = replicate.run(
            "minimax/hailuo-2.3-fast",
            input=inputs
        )
        
        filename = f"mkt_{uuid.uuid4().hex}.mp4"
        filepath = VIDEOS_DIR / filename
        
        with open(filepath, "wb") as file:
            file.write(output.read())
            
        logger.info("Saved marketing video: %s", filename)
        return f"/uploads/videos/{filename}"
    except Exception as e:
        logger.error("Marketing video generation failed: %s", e)
        raise RuntimeError(f"Video generation failed: {e}")


# â”€â”€ Public async API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def generate_marketing_image(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
    reference_image_b64: str | None = None,
    reference_mime: str = "image/png",
) -> dict:
    """Generate a marketing ad image. Returns dict with image_url and ai_text."""
    prompt = _build_image_prompt(brand_name, ad_text, user_prompt)
    logger.info("Marketing image prompt (%d chars): %sâ€¦", len(prompt), prompt[:120])

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
    logger.info("Marketing video prompt (%d chars, mode=%s): %sâ€¦",
                len(prompt), video_mode, prompt[:120])

    ref_bytes: bytes | None = None
    if reference_image_b64 and video_mode == "image_to_video":
        ref_bytes = base64.b64decode(reference_image_b64)

    loop = asyncio.get_running_loop()
    video_url = await loop.run_in_executor(
        None, partial(_sync_marketing_video, prompt, ref_bytes, reference_mime)
    )

    return {"video_url": video_url}
