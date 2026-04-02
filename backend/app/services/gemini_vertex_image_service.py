"""
Image generation via Google Gemini on Vertex AI.

This module is intentionally dedicated to Vertex AI to avoid confusion with
older Replicate-based image implementations.
"""
from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import httpx
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.google_credentials import decode_google_service_account_json

logger = logging.getLogger(__name__)

GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
_VERTEX_CREDENTIALS_PATH: Path | None = None


def _ensure_vertex_credentials() -> None:
    """Ensure ADC credentials are available for Vertex AI client auth."""
    global _VERTEX_CREDENTIALS_PATH

    existing = (os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
    if existing:
        return

    raw = decode_google_service_account_json(settings.GOOGLE_CREDENTIALS_JSON)
    if not raw:
        return

    if _VERTEX_CREDENTIALS_PATH and _VERTEX_CREDENTIALS_PATH.is_file():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_VERTEX_CREDENTIALS_PATH)
        return

    fd, temp_path = tempfile.mkstemp(prefix="laurena-vertex-sa-", suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(raw)

    _VERTEX_CREDENTIALS_PATH = Path(temp_path)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_VERTEX_CREDENTIALS_PATH)


def _get_vertex_client() -> genai.Client:
    """Get a Vertex AI Gemini client."""
    project = (settings.GOOGLE_CLOUD_PROJECT or "").strip()
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required for Vertex AI image generation.")

    location = (settings.GOOGLE_CLOUD_LOCATION or "us-central1").strip() or "us-central1"

    _ensure_vertex_credentials()
    return genai.Client(vertexai=True, project=project, location=location)


def _build_image_config(style: str | None = None) -> types.GenerateContentConfig:
    """Build Gemini image config with consistent creative guardrails."""
    system_text = (
        "You are an expert visual designer and creative director.\n"
        "Generate one final, high-quality image that matches the user request exactly.\n"
        "Constraints:\n"
        "- Professional composition with clear focal point.\n"
        "- Keep visual hierarchy and readability.\n"
        "- No watermark or unrelated logos.\n"
        "- Return only the generated image.\n"
    )
    if style:
        system_text += f"- Creative style: {style}.\n"

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


def _build_enhanced_prompt(user_prompt: str, style: str | None = None) -> str:
    """Build context-rich prompt to improve consistency and intent retention."""
    parts = [
        "Task: Generate an image for this request:",
        f"\n\n{user_prompt.strip()}",
    ]
    if style:
        parts.append(f"\n\nVisual style: {style}")

    parts.append(
        "\n\nQuality constraints:\n"
        "- High quality and coherent composition\n"
        "- Clear subject and visual intent\n"
        "- No artifacts or watermarks"
    )
    return "".join(parts)


def _fallback_pexels_image_bytes(prompt: str) -> Optional[bytes]:
    """Return image bytes from Pexels only when Gemini fails."""
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
    """Force Gemini 2.5 Flash Image for both AI Studio and Marketing AI."""
    if requested_model and requested_model != GEMINI_IMAGE_MODEL:
        logger.warning(
            "Unsupported image model '%s' requested. Forcing '%s'.",
            requested_model,
            GEMINI_IMAGE_MODEL,
        )
    return GEMINI_IMAGE_MODEL


def run_vertex_gemini_image(
    prompt: str,
    *,
    image_bytes: Optional[bytes] = None,
    reference_mime: str = "image/png",
    style: str | None = None,
    model: str | None = None,
) -> bytes:
    """Generate image bytes using Gemini 2.5 Flash Image on Vertex AI."""
    selected_model = _resolve_image_model(model)
    client = _get_vertex_client()
    config = _build_image_config(style=style)

    parts: list[types.Part] = []
    if image_bytes:
        mime = reference_mime or "image/png"
        parts.append(types.Part.from_text(text="Use this image as visual reference:"))
        parts.append(types.Part(inline_data=types.Blob(mime_type=mime, data=image_bytes)))

    enhanced_prompt = _build_enhanced_prompt(prompt, style=style)
    parts.append(types.Part.from_text(text=enhanced_prompt))

    contents = [types.Content(role="user", parts=parts)]

    logger.info(
        "Calling Vertex Gemini image model=%s (img2img=%s, style=%s)",
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
    except Exception as exc:
        logger.error("Vertex Gemini image generation failed: %s", exc)
        fallback = _fallback_pexels_image_bytes(prompt)
        if fallback:
            logger.info("Using Pexels fallback after Vertex Gemini failure")
            return fallback
        raise RuntimeError("Falha na geração de imagem com IA.") from exc

    if not image_data:
        logger.warning("Vertex Gemini returned no image; trying Pexels fallback")
        fallback = _fallback_pexels_image_bytes(prompt)
        if fallback:
            return fallback
        raise RuntimeError("Gemini nao devolveu nenhuma imagem.")

    logger.info("Vertex Gemini image generation succeeded: %d bytes", len(image_data))
    return image_data
