"""
Replicate HTTP API — text-to-image (ex.: black-forest-labs/flux-dev).
Uses the Replicate Python client library.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Any, Optional

import httpx
import replicate

from app.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_IMAGE_MIMES = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif"})


def _download_image_bytes(url: str) -> bytes:
    with httpx.Client(timeout=120.0) as client:
        r = client.get(url, follow_redirects=True)
        r.raise_for_status()
        return r.content


def _coerce_replicate_image_bytes(output: Any) -> bytes:
    """Normalize Replicate model output to raw image bytes."""
    if output is None:
        raise RuntimeError("Replicate não devolveu output.")

    if isinstance(output, (bytes, bytearray)):
        data = bytes(output)
        if not data:
            raise RuntimeError("Replicate devolveu bytes vazios.")
        return data

    if isinstance(output, str):
        if output.startswith("http://") or output.startswith("https://"):
            return _download_image_bytes(output)
        raise RuntimeError(f"Replicate devolveu string inesperada: {output[:80]!r}…")

    if isinstance(output, (list, tuple)):
        items: list[Any] = list(output)
    elif type(output).__name__ == "generator":
        items = list(output)
    else:
        items = [output]

    if not items:
        raise RuntimeError("Resultado do Replicate está vazio.")

    first_item = items[0]

    if isinstance(first_item, str):
        if first_item.startswith("http://") or first_item.startswith("https://"):
            return _download_image_bytes(first_item)
        raise RuntimeError("Primeiro item da lista não é uma URL.")

    if hasattr(first_item, "read") and callable(first_item.read):
        result_bytes = first_item.read()
        if not result_bytes:
            raise RuntimeError("Replicate devolveu ficheiro vazio (0 bytes).")
        return result_bytes if isinstance(result_bytes, bytes) else bytes(result_bytes)

    url = getattr(first_item, "url", None)
    if url:
        return _download_image_bytes(str(url))

    return _download_image_bytes(str(first_item))


def run_replicate_image(
    prompt: str,
    *,
    aspect_ratio: str = "1:1",
    image_bytes: Optional[bytes] = None,
    reference_mime: str = "image/png",
) -> bytes:
    token = (settings.REPLICATE_API_TOKEN or "").strip()
    if not token:
        raise RuntimeError(
            "REPLICATE_API_TOKEN não está definido. Adicione no .env para gerar imagens."
        )

    os.environ["REPLICATE_API_TOKEN"] = token

    model_slug = (settings.REPLICATE_IMAGE_MODEL or "black-forest-labs/flux-dev").strip()
    p = prompt.strip()

    # Parâmetros alinhados aos exemplos oficiais do FLUX.1 [dev] no Replicate (llms.txt).
    input_data: dict[str, Any] = {
        "prompt": p,
        "aspect_ratio": aspect_ratio,
        "output_format": "webp",
        "num_outputs": 1,
        "go_fast": True,
        "guidance": 3.5,
        "num_inference_steps": 28,
        "output_quality": 85,
    }

    if image_bytes:
        mime = (reference_mime or "image/png").strip().lower()
        if mime not in _ALLOWED_IMAGE_MIMES:
            mime = "image/png"
        data_b64 = base64.b64encode(image_bytes).decode("utf-8")
        input_data["image"] = f"data:{mime};base64,{data_b64}"
        input_data["prompt_strength"] = 0.82

    logger.info("Running Replicate model: %s (img2img=%s)", model_slug, bool(image_bytes))
    try:
        output = replicate.run(model_slug, input=input_data)
    except Exception as e:
        logger.error("Falha ao chamar Replicate: %s", e)
        raise RuntimeError(f"Replicate error: {e}") from e

    result_bytes = _coerce_replicate_image_bytes(output)
    if not result_bytes:
        raise RuntimeError("Replicate devolveu ficheiro vazio (0 bytes).")

    logger.info("Replicate: %d bytes (modelo=%s)", len(result_bytes), model_slug)
    return result_bytes
