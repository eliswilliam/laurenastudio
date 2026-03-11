"""
services/ai_service.py
Google Gemini AI integration — text + image + video generation.
Uses google-genai SDK:
  - Text/Image: vertexai=True with API key (gemini-2.5-flash-image)
  - Video: vertexai=True with ADC + project/location (veo-3.1-generate-001)
"""
import asyncio
import base64
import logging
import os
import time
import uuid
from functools import partial
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

# Upload directories
GENERATED_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

VIDEOS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

_client: genai.Client | None = None
_video_client: genai.Client | None = None
_video_use_vertex: bool = False


def _get_client() -> genai.Client:
    """Client for Gemini text/image generation (api_key + vertexai)."""
    global _client
    if _client is None:
        _client = genai.Client(
            vertexai=True,
            api_key=settings.GOOGLE_CLOUD_API_KEY,
        )
    return _client


def _ensure_gcloud_credentials() -> None:
    """Ensure GOOGLE_APPLICATION_CREDENTIALS is set for the Vertex AI SDK.

    Priority:
    1. Already set via env var (e.g. docker-compose volume mount)
    2. ADC file exists at the default Docker path
    3. GOOGLE_CREDENTIALS_JSON env var contains service account JSON (Azure)
    """
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return

    adc_path = "/root/.config/gcloud/application_default_credentials.json"
    if os.path.exists(adc_path):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = adc_path
        return

    creds_json = settings.GOOGLE_CREDENTIALS_JSON
    if creds_json:
        sa_path = "/tmp/gcloud_sa_key.json"
        Path(sa_path).write_text(creds_json)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = sa_path
        logger.info("Wrote service account key from GOOGLE_CREDENTIALS_JSON to %s", sa_path)


def _get_video_client() -> genai.Client:
    """Client for Veo video generation.

    Strategy:
    1. If ADC credentials available → Vertex AI with project/location (full features)
    2. Else → Google AI with API key (same key as text/image, works on Azure)
    """
    global _video_client, _video_use_vertex
    if _video_client is None:
        _ensure_gcloud_credentials()

        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            _video_client = genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_LOCATION,
            )
            _video_use_vertex = True
            logger.info("Video client: Vertex AI (ADC + project/location)")
        elif settings.GOOGLE_CLOUD_API_KEY:
            _video_client = genai.Client(
                api_key=settings.GOOGLE_CLOUD_API_KEY,
            )
            _video_use_vertex = False
            logger.info("Video client: Google AI (API key)")
        else:
            raise RuntimeError(
                "No credentials for video generation. "
                "Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_API_KEY."
            )
    return _video_client


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


# ── Video generation (Veo 3.1) ─────────────────────────────────────────────


def _sync_generate_video(prompt: str, *, style: str | None = None) -> str:
    """Blocking call to Veo — generates a video, polls until done, saves to disk.
    Returns the relative URL path to the saved video file.
    """
    client = _get_video_client()

    full_prompt = prompt
    if style:
        full_prompt = f"{prompt}. Style: {style}"

    source = types.GenerateVideosSource(prompt=full_prompt)

    config_kwargs = dict(
        aspect_ratio="16:9",
        number_of_videos=1,
        duration_seconds=8,
        person_generation="allow_all",
    )
    # generate_audio is only supported on Vertex AI
    if _video_use_vertex:
        config_kwargs["generate_audio"] = True

    config = types.GenerateVideosConfig(**config_kwargs)

    logger.info("Starting Veo 3.1 video generation: prompt=%s", full_prompt[:80])

    operation = client.models.generate_videos(
        model="veo-3.1-generate-001",
        source=source,
        config=config,
    )

    # Poll until done (max ~5 min)
    max_wait = 300
    elapsed = 0
    poll_interval = 10
    while not operation.done and elapsed < max_wait:
        logger.info("Video not ready yet, polling in %ds... (%ds elapsed)", poll_interval, elapsed)
        time.sleep(poll_interval)
        elapsed += poll_interval
        operation = client.operations.get(operation)

    if not operation.done:
        raise RuntimeError("Video generation timed out after 5 minutes.")

    response = operation.result
    if not response:
        logger.error("Veo returned done=True but result is None (content may have been filtered)")
        raise RuntimeError("Video generation completed but returned no result. The content may have been filtered by safety policies. Try a different prompt.")

    generated_videos = response.generated_videos
    if not generated_videos:
        logger.error("Veo returned result but generated_videos is empty")
        raise RuntimeError("No videos were generated. Try a different prompt.")

    video = generated_videos[0]
    if not video.video or not video.video.video_bytes:
        raise RuntimeError("Generated video has no data.")

    video_bytes = video.video.video_bytes
    filename = f"{uuid.uuid4().hex}.mp4"
    filepath = VIDEOS_DIR / filename
    filepath.write_bytes(video_bytes)
    logger.info("Saved generated video: %s (%d bytes)", filename, len(video_bytes))
    return f"/uploads/videos/{filename}"


async def generate_video(
    prompt: str,
    *,
    model: str | None = None,
    style: str | None = None,
) -> str:
    """Generate a video via Veo 3.1. Returns relative URL to the saved file."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, partial(_sync_generate_video, prompt, style=style)
    )
