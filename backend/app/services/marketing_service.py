"""
services/marketing_service.py
Marketing AI — imagens via Gemini on Vertex AI (com fallback Pexels);
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
from app.services.gemini_vertex_image_service import (
    GEMINI_IMAGE_MODEL,
    run_vertex_gemini_image,
)

logger = logging.getLogger(__name__)


# â”€â”€ Prompt optimization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _clean(value: str | None) -> str:
    return (value or "").strip()

def _build_image_prompt(
    brand_name: str,
    ad_text: str,
    user_prompt: str | None = None,
) -> str:
    """Build a structured prompt for advertising/propaganda image generation.

    Produces a high-impact social-ad creative with the brand name and ad copy
    overlaid on a professional visual. Designed for gemini-2.5-flash-image on
    Vertex AI, which understands rich multi-section prompts.
    """
    brand = _clean(brand_name)
    copy = _clean(ad_text)
    direction = _clean(user_prompt)

    parts = [
        "You are a world-class advertising creative director and visual designer.",
        "Task: Generate ONE final, print-ready advertising image — a high-impact",
        "propaganda-style social-media ad creative with bold visual identity.",
        "",
        "═══ BRAND & MESSAGE ═══",
        f"Brand name: {brand}",
        f"Advertising copy / slogan: {copy}",
    ]

    if direction:
        parts += [
            "",
            "═══ CREATIVE DIRECTION FROM CLIENT ═══",
            direction,
        ]

    parts += [
        "",
        "═══ VISUAL DESIGN SPECIFICATIONS ═══",
        "Layout:",
        f"  • The brand name «{brand}» must appear prominently — large, bold, highly legible.",
        f"  • The ad copy «{copy}» must be displayed as overlay text — clear, punchy, mobile-readable.",
        "  • Use a strong hero visual that embodies the brand's essence.",
        "  • Apply a visual hierarchy: hero image → brand name → ad copy → optional CTA badge.",
        "",
        "Typography:",
        "  • Use bold, impactful sans-serif font for the brand name.",
        "  • Use clean, readable font for the ad copy — max 2 lines.",
        "  • Ensure strong contrast between text and background (white text on dark, or vice versa).",
        "  • Add subtle text shadow or background stroke to guarantee legibility over busy visuals.",
        "",
        "Color & Mood:",
        "  • Choose a cohesive color palette that matches the brand's personality.",
        "  • Create a visually arresting composition — think premium magazine ad or billboard.",
        "  • Use high contrast and vibrant colors to stop the scroll.",
        "",
        "Composition (1:1 square format for social ads):",
        "  • Full-bleed background — no white margins, no device mockup, no frame.",
        "  • Dynamic, asymmetric layout with clear breathing space around text.",
        "  • Professional product/lifestyle photo or graphic illustration as the hero element.",
        "",
        "═══ OUTPUT CONSTRAINTS ═══",
        "  • Return only the finished ad image — no borders, no watermarks, no lorem ipsum.",
        "  • No unrelated logos or brand marks.",
        "  • The image must be immediately usable as a paid social ad (Facebook, Instagram, etc.).",
        "  • Square 1:1 format. High resolution. Mobile-first readability.",
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

def _detect_mime(data: bytes) -> str:
    if data[:4] == b"\x89PNG":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return "image/png"


def _sync_marketing_image(
    prompt: str,
    reference_image_bytes: bytes | None = None,
    reference_mime: str = "image/png",
    pexels_query_hint: str = "",
) -> tuple[str, bytes | None, str]:
    """Imagem publicitária via Imagen 3 (text-to-image).

    Falls back to Pexels only when Imagen fails, using brand name as query hint
    (not the full AI prompt) so the result varies across calls.
    """
    from app.services.gemini_vertex_image_service import _fallback_pexels_image_bytes
    try:
        image_data = run_vertex_gemini_image(
            prompt,
            image_bytes=reference_image_bytes,
            reference_mime=reference_mime,
            model=GEMINI_IMAGE_MODEL,
        )
        return "", image_data, _detect_mime(image_data)
    except RuntimeError as exc:
        logger.warning("Imagen marketing image failed, trying Pexels fallback: %s", exc)
        fallback = _fallback_pexels_image_bytes(pexels_query_hint or "advertising creative")
        if fallback:
            logger.info("Pexels fallback used for marketing image (hint=%r)", pexels_query_hint[:40])
            return "", fallback, _detect_mime(fallback)
        raise


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

    # pexels_query_hint uses brand + ad text so the fallback varies per brand,
    # not the full AI prompt which starts with the same boilerplate every time.
    pexels_hint = f"{brand_name} {ad_text}"[:80]

    loop = asyncio.get_running_loop()
    text, image_data, image_mime = await loop.run_in_executor(
        None,
        partial(_sync_marketing_image, prompt, ref_bytes, reference_mime, pexels_hint),
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
