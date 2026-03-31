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

def run_replicate_image(
    prompt: str,
    *,
    aspect_ratio: str = "1:1",
    image_bytes: Optional[bytes] = None,
    reference_mime: str = "image/png",
) -> bytes:
    """
    Generate image using Gemini image model via Generative Language API.
    This endpoint supports API key authentication.
    """
    api_key = os.environ.get("GOOGLE_CLOUD_API_KEY") or (settings.GOOGLE_CLOUD_API_KEY or settings.GOOGLE_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_CLOUD_API_KEY is missing. Configure a chave da API do Google.")

    model = "gemini-2.5-flash-image"
    
    # Build the request payload
    parts = []
    if image_bytes:
        mime = reference_mime or "image/png"
        data_b64 = base64.b64encode(image_bytes).decode("utf-8")
        parts.append({
            "inlineData": {
                "mimeType": mime,
                "data": data_b64
            }
        })
    
    parts.append({
        "text": prompt.strip() or "Uma imagem generica."
    })

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": parts
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"]
        }
    }

    # API-key compatible endpoint
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    logger.info("Calling Gemini image model: %s (img2img=%s)", model, bool(image_bytes))

    image_data = None
    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            
            result = response.json()
            if "candidates" in result and result["candidates"]:
                for part in result["candidates"][0].get("content", {}).get("parts", []):
                    if "inlineData" in part:
                        image_data = base64.b64decode(part["inlineData"]["data"])
                        break

    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else None
        logger.error("Falha ao chamar Gemini Image API: status=%s", status)
        if status in (401, 403, 429):
            fallback = _fallback_pexels_image_bytes(prompt)
            if fallback:
                logger.info("Using Pexels fallback image after Gemini failure status=%s", status)
                return fallback
        if status == 429:
            raise RuntimeError("Serviço de imagem temporariamente indisponível (limite atingido).") from e
        raise RuntimeError("Falha na geração de imagem com IA.") from e
    except Exception as e:
        logger.error("Falha ao chamar Gemini Image API: %s", e)
        raise RuntimeError("Falha na geração de imagem com IA.") from e

    if not image_data:
        raise RuntimeError("Gemini nao devolveu nenhuma imagem.")

    logger.info("Gemini Image gerada com sucesso: %d bytes", len(image_data))
    return image_data
