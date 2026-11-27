"""
Image generation via Google Imagen 3 on Vertex AI.

Primary model  : imagen-3.0-generate-002 (Imagen 3, Vertex AI)
Fast model     : imagen-3.0-fast-generate-001 (same, lower latency)
Fallback       : Pexels stock photos (opt-in by callers)
"""
from __future__ import annotations

import logging
import random
from typing import Optional

import httpx
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.google_credentials import ensure_google_application_credentials

logger = logging.getLogger(__name__)

# Imagen 3 on Vertex AI — high quality, commercially available
GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002"
GEMINI_IMAGE_MODEL_FAST = "imagen-3.0-fast-generate-001"
# Imagen 3 editing — used when a reference image is provided (image-to-image)
IMAGEN_EDIT_MODEL = "imagen-3.0-capability-001"


def _ensure_vertex_credentials() -> None:
    resolved = ensure_google_application_credentials(settings.GOOGLE_CREDENTIALS_JSON)
    if resolved:
        return
    logger.warning(
        "Vertex ADC credentials not found. Configure GOOGLE_APPLICATION_CREDENTIALS, "
        "run 'gcloud auth application-default login', or set GOOGLE_CREDENTIALS_JSON."
    )


def _get_vertex_client() -> genai.Client:
    project = (settings.GOOGLE_CLOUD_PROJECT or "").strip()
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required for Vertex AI image generation.")
    location = (settings.GOOGLE_CLOUD_LOCATION or "us-central1").strip() or "us-central1"
    _ensure_vertex_credentials()
    return genai.Client(vertexai=True, project=project, location=location)


def _build_enhanced_prompt(user_prompt: str, style: str | None = None) -> str:
    parts = [user_prompt.strip()]
    if style:
        parts.append(f"Style: {style}.")
    parts.append("High quality, professional composition, no watermarks.")
    return " ".join(parts)


def _fallback_pexels_image_bytes(query_hint: str) -> Optional[bytes]:
    """Pexels fallback — only called explicitly from callers that opt in."""
    pexels_key = (settings.PEXELS_API_KEY or "").strip()
    if not pexels_key:
        return None

    query = (query_hint or "creative professional photo").strip()[:80]
    page = random.randint(1, 8)

    try:
        with httpx.Client(timeout=30.0) as client:
            search = client.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": 3, "page": page},
                headers={"Authorization": pexels_key},
            )
            if search.status_code != 200:
                logger.warning("Pexels fallback search failed: status=%s", search.status_code)
                return None

            payload = search.json()
            photos = payload.get("photos") or []
            if not photos:
                return None

            photo = random.choice(photos)
            src = photo.get("src") or {}
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


def _extract_image_bytes(response_images: list) -> bytes:
    """Extract raw bytes from the first Imagen generated image object."""
    if not response_images:
        raise RuntimeError("Imagen returned no images for the given prompt.")
    first = response_images[0]
    data: bytes | None = None
    if hasattr(first, "image") and first.image:
        data = first.image.image_bytes
    elif hasattr(first, "image_bytes"):
        data = first.image_bytes
    if not data:
        raise RuntimeError("Imagen returned an image object with no bytes.")
    return data


def run_vertex_gemini_image(
    prompt: str,
    *,
    image_bytes: Optional[bytes] = None,
    reference_mime: str = "image/png",
    style: str | None = None,
    model: str | None = None,
) -> bytes:
    """Generate or edit an image using Imagen 3 on Vertex AI.

    - No reference image  → text-to-image via imagen-3.0-generate-002
    - With reference image → image-to-image edit via imagen-3.0-capability-001
    Raises RuntimeError on failure — callers decide whether to apply a fallback.
    """
    client = _get_vertex_client()
    enhanced_prompt = _build_enhanced_prompt(prompt, style=style)

    if image_bytes:
        # Image-to-image: use the editing model with the uploaded image as reference
        logger.info(
            "Calling Vertex Imagen edit model=%s img2img=True style=%s",
            IMAGEN_EDIT_MODEL,
            style or "none",
        )
        try:
            response = client.models.edit_image(
                model=IMAGEN_EDIT_MODEL,
                prompt=enhanced_prompt,
                reference_images=[
                    types.RawReferenceImage(
                        reference_image=types.Image(image_bytes=image_bytes),
                        reference_id=0,
                    )
                ],
                config=types.EditImageConfig(number_of_images=1),
            )
        except Exception as exc:
            logger.error("Vertex Imagen edit failed: %s", exc)
            raise RuntimeError(f"Imagen edit failed: {exc}") from exc
        image_data = _extract_image_bytes(response.generated_images or [])
    else:
        # Text-to-image: use the generation model
        selected_model = model if model in (GEMINI_IMAGE_MODEL, GEMINI_IMAGE_MODEL_FAST) else GEMINI_IMAGE_MODEL
        logger.info(
            "Calling Vertex Imagen generate model=%s style=%s",
            selected_model,
            style or "none",
        )
        try:
            response = client.models.generate_images(
                model=selected_model,
                prompt=enhanced_prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    safety_filter_level="BLOCK_ONLY_HIGH",
                    person_generation="ALLOW_ADULT",
                ),
            )
        except Exception as exc:
            logger.error("Vertex Imagen generation failed model=%s: %s", selected_model, exc)
            raise RuntimeError(f"Imagen generation failed: {exc}") from exc
        image_data = _extract_image_bytes(response.generated_images or [])

    logger.info("Vertex Imagen succeeded: %d bytes", len(image_data))
    return image_data
