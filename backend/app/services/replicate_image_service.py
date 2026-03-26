"""
Replicate HTTP API — text-to-image (ex.: black-forest-labs/flux-dev).
Uses the Replicate Python client library.
"""
from __future__ import annotations

import logging
import os
import base64
from typing import Any, Optional

import replicate

from app.core.config import settings

logger = logging.getLogger(__name__)

def run_replicate_image(prompt: str, *, aspect_ratio: str = "1:1", image_bytes: Optional[bytes] = None) -> bytes:
    token = (settings.REPLICATE_API_TOKEN or "").strip()
    if not token:
        raise RuntimeError(
            "REPLICATE_API_TOKEN não está definido. Adicione no .env para gerar imagens."
        )
    
    # Assegura que o token está na variável de ambiente esperada pelo cliente
    os.environ["REPLICATE_API_TOKEN"] = token
    
    model_slug = (settings.REPLICATE_IMAGE_MODEL or "black-forest-labs/flux-dev").strip()
    p = prompt.strip()

    # Parâmetros para o modelo
    input_data = {
        "prompt": p,
        "aspect_ratio": aspect_ratio,
        "output_format": "webp"
    }

    if image_bytes:
        data_b64 = base64.b64encode(image_bytes).decode("utf-8")
        input_data["image"] = f"data:application/octet-stream;base64,{data_b64}"
        # Se for imagem-a-imagem no FLUX, pode requerer parâmetros extra dependendo da versão,
        # mas flux-dev suporta prompt_strength (opcional) etc. O payload aceitará `image`.

    logger.info("Running Replicate model: %s", model_slug)
    try:
        output = replicate.run(
            model_slug,
            input=input_data
        )
    except Exception as e:
        logger.error("Falha ao chamar Replicate: %s", e)
        raise RuntimeError(f"Replicate error: {e}") from e

    if not output:
        raise RuntimeError("Replicate não devolveu output.")

    try:
        # Se for um gerador ou lista de links/FileOutput, iterar/pegar o primeiro
        items = list(output) if (type(output).__name__ == "generator" or isinstance(output, list)) else [output]
        if not items:
            raise RuntimeError("Resultado iterável do Replicate está vazio.")
            
        first_item = items[0]
        # Compatibilidade com o objeto FileOutput do Replicate Python Client
        if hasattr(first_item, "read") and callable(first_item.read):
            result_bytes = first_item.read()
        else:
            import httpx
            # Fallback se for apenas uma string com a URL
            url = getattr(first_item, "url", str(first_item))
            with httpx.Client(timeout=120.0) as client:
                r = client.get(url, follow_redirects=True)
                r.raise_for_status()
                result_bytes = r.content
                
    except Exception as e:
        raise RuntimeError(f"Erro ao ler imagem do Replicate: {e}. Output: {output}")

    if not result_bytes:
        raise RuntimeError("Replicate devolveu ficheiro vazio (0 bytes).")
        
    logger.info("Replicate: %d bytes (modelo=%s)", len(result_bytes), model_slug)
    return result_bytes
