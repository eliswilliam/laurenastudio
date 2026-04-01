"""
Google Gemini image generation using API key (Generative Language API).
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx
import base64

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"


def _get_gemini_client():
    """Get Gemini client using google.genai library (same as ai_service)."""
    from google import genai
    
    api_key = (settings.GOOGLE_CLOUD_API_KEY or settings.GOOGLE_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_CLOUD_API_KEY or GOOGLE_API_KEY is missing.")
    return genai.Client(vertexai=False, api_key=api_key)


def _build_gemini_image_config(style: str | None = None):
    """Build GenerateContentConfig for image (complete config matching text generation)."""
    from google.genai import types
    
    system_text = (
        "You are an expert visual designer and creative director.\n"
        "Your task: generate ONE final, high-quality image that directly matches the user's request.\n"
        "Constraints:\n"
        "- Composition must be visually balanced, professional, modern.\n"
        "- Subject/text must be clear and readable.\n"
        "- No text overlays unless explicitly requested.\n"
        "- Cohesive color palette, consistent lighting.\n"
        "- High contrast; mobile-first visual hierarchy.\n"
        "- No watermark or unintended logos.\n"
        "- Return only the final image; no explanations.\n"
    )
    if style:
        system_text += f"- Creative style/tone: {style}.\n"

    return types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=8192,
        response_modalities=["IMAGE"],
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


def _build_enhanced_image_prompt(user_prompt: str, style: str | None = None) -> str:
    """Build context-rich prompt for better understanding."""
    parts = [
        "Task: Generate an image matching this request:",
        f"\n\n{user_prompt.strip()}",
    ]
    if style:
        parts.append(f"\n\nVisual style/tone: {style}")
    parts.append(
        "\n\nEnsure the final image is:\n"
        "- Clear, professional, modern\n"
        "- Visually balanced with strong focal point\n"
        "- High quality, suitable for professional use\n"
        "- No watermark or unintended logos"
    )
    return "".join(parts)


def _fallback_pexels_image_bytes(prompt: str) -> Optional[bytes]:
    """Return image bytes from Pexels when Gemini image is unavailable."""
    pexels_key = (settings.PEXELS_API_KEY or "").strip()
    if not pexels_key:
        return None

    query = (prompt or "business professional photo").strip()[:140]
    try:
        with httpx.Client(timeout=30.0) as client:
            search = client.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": 1, "page": 1},
                headers={"Authorization": pexels_key},
            )
            if search.status_code != 200:
                logger.warning("Pexels fallback search failed: status=%s", search.status_code)
                return None

            payload = search.json()
            photos = payload.get("photos") or []
            if not photos:
                return None

            src = photos[0].get("src") or {}
            img_url = src.get("large2x") or src.get("large") or src.get("original")
            if not img_url:
                return None

            img = client.get(img_url)
            if img.status_code != 200 or not img.content:
                return None
            return img.content
    except Exception:
        logger.exception("Pexels fallback failed")
        return None


def _resolve_image_model(requested_model: str | None) -> str:
    """Return the enforced Gemini image model and log unsupported overrides."""
    if requested_model and requested_model != GEMINI_IMAGE_MODEL:
        logger.warning(
            "Unsupported image model '%s' requested. Forcing '%s'.",
            requested_model,
            GEMINI_IMAGE_MODEL,
        )
    return GEMINI_IMAGE_MODEL

def run_replicate_image(
    prompt: str,
    *,
    aspect_ratio: str = "1:1",
    image_bytes: Optional[bytes] = None,
    reference_mime: str = "image/png",
    style: str | None = None,
    model: str | None = None,
) -> bytes:
    """
    Generate image using Gemini 2.5 via google.genai (streaming, full config, system instruction).
    Aligned with ai_service.generate_text() pattern for consistency.
    """
    from google.genai import types
    
    client = _get_gemini_client()
    config = _build_gemini_image_config(style=style)
    selected_model = _resolve_image_model(model)

    # Build parts: image reference + enhanced prompt
    parts = []
    if image_bytes:
        mime = reference_mime or "image/png"
        parts.append(
            types.Part.from_text(text="Use this image as visual reference/starting point:")
        )
        parts.append(
            types.Part(
                inline_data=types.Blob(mime_type=mime, data=image_bytes)
            )
        )

    enhanced_prompt = _build_enhanced_image_prompt(prompt, style=style)
    parts.append(types.Part.from_text(text=enhanced_prompt))

    contents = [
        types.Content(
            role="user",
            parts=parts,
        ),
    ]

    logger.info(
        "Calling Gemini image model=%s (streaming, img2img=%s, style=%s)",
        selected_model,
        bool(image_bytes),
        style or "none",
    )

    image_data: bytes | None = None
    try:
        for chunk in client.models.generate_content_stream(
            model=selected_model,
            contents=contents,
            config=config,
        ):
            if not chunk.candidates:
                continue
            for part in chunk.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    image_data = part.inline_data.data
                    break

    except Exception as e:
        logger.error("Gemini image generation failed: %s", e)
        fallback = _fallback_pexels_image_bytes(prompt)
        if fallback:
            logger.info("Using Pexels fallback after Gemini failure")
            return fallback
        raise RuntimeError("Falha na geração de imagem com IA.") from e

    if not image_data:
        logger.warning("Gemini returned no image; trying Pexels fallback")
        fallback = _fallback_pexels_image_bytes(prompt)
        if fallback:
            return fallback
        raise RuntimeError("Gemini nao devolveu nenhuma imagem.")

    logger.info("Gemini image generation succeeded: %d bytes", len(image_data))
    return image_data
