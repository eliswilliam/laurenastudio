"""
services/marketing_service.py
Marketing AI â€” imagens via Replicate (FLUX); vÃ­deos via Replicate (Minimax).

Prompts e briefings mantÃªm-se; a geraÃ§Ã£o de imagem deixa de usar Gemini.
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
        "- Output a single finished ad creative â€” no mockup frames or device outlines\n"
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


# â”€â”€ Sync generation helpers (run in thread pool) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _sync_marketing_image(
    prompt: str,
    reference_image_bytes: bytes | None = None,
    reference_mime: str = "image/png",
) -> tuple[str, bytes | None, str]:
    """Imagem publicitÃ¡ria via Replicate FLUX (text-to-image)."""
    if reference_image_bytes:
        logger.warning(
            "Imagem de referÃªncia nÃ£o Ã© enviada ao FLUX (Replicate); use o texto para descrever o visual."
        )
    image_data = run_replicate_image(prompt, aspect_ratio="1:1", image_bytes=reference_image_bytes)
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
