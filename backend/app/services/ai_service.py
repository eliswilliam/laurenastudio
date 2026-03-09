"""
services/ai_service.py
Google Gemini AI integration — text + image generation.
Uses google-genai SDK with vertexai=True and API key.
Model: gemini-2.5-flash-image with response_modalities=["TEXT","IMAGE"]
"""
import asyncio
import base64
import logging
import uuid
from functools import partial
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

# Upload directory for generated images
GENERATED_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            vertexai=True,
            api_key=settings.GOOGLE_CLOUD_API_KEY,
        )
    return _client


def _build_config(
    *,
    style: str | None = None,
) -> types.GenerateContentConfig:
    """Build the GenerateContentConfig matching the reference app.py."""
    system_text = (
        "voce vai ajudar a criar anunciois pra marketimg, "
        "respondre baseado na linguagem do usuario"
    )
    if style:
        system_text += f"\nUse um tom {style}."

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
        system_instruction=[types.Part.from_text(text=system_text)],
        image_config=types.ImageConfig(
            aspect_ratio="1:1",
            image_size="1K",
            output_mime_type="image/png",
        ),
    )


def _sync_generate(prompt: str, *, style: str | None = None):
    """Blocking call to Gemini — run in a thread from async code."""
    client = _get_client()
    config = _build_config(style=style)

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ),
    ]

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


async def generate_text(
    prompt: str,
    *,
    model: str | None = None,
    style: str | None = None,
) -> str:
    """Generate text content via Gemini."""
    loop = asyncio.get_running_loop()
    text, _, _ = await loop.run_in_executor(
        None, partial(_sync_generate, prompt, style=style)
    )
    if not text.strip():
        raise RuntimeError("No text content in AI response.")
    return text


async def generate_image(
    prompt: str,
    *,
    model: str | None = None,
    style: str | None = None,
) -> str:
    """Generate an image via Gemini. Returns relative URL to the saved file."""
    loop = asyncio.get_running_loop()
    text, image_data, image_mime = await loop.run_in_executor(
        None, partial(_sync_generate, prompt, style=style)
    )

    if image_data:
        ext = image_mime.split("/")[-1]
        if ext == "jpeg":
            ext = "jpg"
        if ext not in ("png", "jpg", "gif", "webp"):
            ext = "png"
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = GENERATED_DIR / filename
        filepath.write_bytes(image_data)
        logger.info("Saved generated image: %s (%d bytes)", filename, len(image_data))
        return f"/uploads/generated/{filename}"

    # Model returned only text, no image
    if text.strip():
        logger.warning("No image in response, returning text fallback")
        return text.strip()

    raise RuntimeError("Gemini did not return an image for the given prompt.")
