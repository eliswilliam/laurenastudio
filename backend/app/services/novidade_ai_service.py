from __future__ import annotations

import asyncio
import logging
import mimetypes
from threading import Thread
from pathlib import Path
from typing import Any, AsyncIterator
from urllib.parse import urlparse

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.google_credentials import ensure_google_application_credentials

logger = logging.getLogger(__name__)

_UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

SYSTEM_PROMPT = """
You are Laurena Builder, an expert AI assistant and exceptional senior software developer.
Return usable code directly with laurena tags, without intermediate JSON.

Rules:
- Always answer with one <laurenaArtifact> containing one or more <laurenaAction type=\"file\" filePath=\"...\"> blocks.
- File paths must be relative.
- Return complete file contents, never partial diffs.
- Keep output concise and implementation-ready.
- Always generate a runnable HTML entry for immediate preview: include index.html (required), and include styles.css/app.js when needed.
- For images in generated sites: ALWAYS prefer Pexels URLs (images.pexels.com) from the provided image library. Use them directly in <img src="..."> tags.
- Only fall back to placeholder hosts (picsum.photos, placehold.co) when no Pexels or user-uploaded image is available for a given section.
- Never invent or guess image URLs. Only use URLs explicitly listed in the Available images section.
- Use provided user-uploaded image URLs when they are relevant.
""".strip()


class GeminiStreamError(RuntimeError):
    pass


def _as_chat_transcript(messages: list[dict[str, str]]) -> str:
    chunks: list[str] = []
    for msg in messages:
        role = (msg.get("role") or "").strip().lower()
        if role not in {"user", "assistant"}:
            continue
        content = str(msg.get("content") or "").strip()
        if not content:
            continue
        chunks.append(f"[{role}]\n{content}")
    return "\n\n".join(chunks)


def _absolutize_upload_url(url: str) -> str:
    clean = str(url or "").strip()
    if not clean:
        return ""
    if clean.startswith("http://") or clean.startswith("https://"):
        return clean
    if clean.startswith("/"):
        backend = (settings.BACKEND_URL or "").strip().rstrip("/")
        if backend:
            return f"{backend}{clean}"
    return clean


def _iter_attachment_urls(attachments: list[dict[str, Any]] | None) -> list[str]:
    out: list[str] = []
    if not attachments:
        return out
    for att in attachments:
        if not isinstance(att, dict):
            continue
        raw = att.get("url") or att.get("file_url") or att.get("fileUrl")
        url = _absolutize_upload_url(str(raw or ""))
        if not url:
            continue
        if url not in out:
            out.append(url)
    return out


def _resolve_local_media_path(url: str) -> Path | None:
    clean = str(url or "").strip()
    if not clean:
        return None

    path = clean
    if clean.startswith("http://") or clean.startswith("https://"):
        parsed = urlparse(clean)
        path = parsed.path

    marker = "/uploads/media/"
    idx = path.find(marker)
    if idx == -1:
        return None

    filename = path[idx + len(marker):].split("?")[0].strip()
    if not filename:
        return None

    safe_name = Path(filename).name
    return _UPLOADS_DIR / "media" / safe_name


def _inline_image_parts_from_attachments(attachments: list[dict[str, Any]] | None) -> list[types.Part]:
    parts: list[types.Part] = []
    seen: set[str] = set()

    for url in _iter_attachment_urls(attachments):
        local_path = _resolve_local_media_path(url)
        if local_path is None or not local_path.is_file():
            continue
        key = str(local_path.resolve())
        if key in seen:
            continue
        seen.add(key)

        try:
            mime, _ = mimetypes.guess_type(local_path.name)
            mime_type = (mime or "application/octet-stream").lower()
            if not mime_type.startswith("image/"):
                continue
            data = local_path.read_bytes()
            if len(data) > 8 * 1024 * 1024:
                continue
            parts.append(types.Part(inline_data=types.Blob(mime_type=mime_type, data=data)))
            if len(parts) >= 4:
                break
        except Exception:
            logger.warning("novidade: failed to load attachment bytes from %s", local_path, exc_info=True)

    return parts


def _gemini_contents(
    messages: list[dict[str, str]],
    codebase_info: str,
    attachments: list[dict[str, Any]] | None,
    workspace_image_urls: list[str] | None,
    pexels_image_urls: list[str] | None = None,
) -> list[types.Content]:
    cleaned: list[dict[str, str]] = []
    for msg in messages:
        role = (msg.get("role") or "").strip()
        if role not in {"user", "assistant"}:
            continue
        content = str(msg.get("content") or "")
        cleaned.append({"role": role, "content": content})

    transcript = _as_chat_transcript(cleaned)

    attachment_urls = _iter_attachment_urls(attachments)
    db_urls: list[str] = []
    for raw in workspace_image_urls or []:
        url = _absolutize_upload_url(raw)
        if url and url not in db_urls:
            db_urls.append(url)

    # Pexels stock photos — highest priority for site images
    pexels_urls: list[str] = []
    for raw in pexels_image_urls or []:
        url = raw.strip()
        if url and url not in pexels_urls:
            pexels_urls.append(url)

    # Build image library: user uploads first, then Pexels, then attachments
    image_library = attachment_urls + [u for u in db_urls if u not in attachment_urls]
    image_library = image_library[:30]

    pexels_block = "(none)"
    if pexels_urls:
        pexels_block = "\n".join(f"- {u}" for u in pexels_urls)

    image_library_block = "(none)"
    if image_library:
        image_library_block = "\n".join(f"- {u}" for u in image_library)

    user_prompt = (
        "This is my codebase context:\n\n"
        f"{codebase_info or '(empty codebase)'}\n\n"
        "Image asset policy:\n"
        "- PRIORITY 1: Use Pexels stock photos listed below — place them in <img src=\"...\"> tags directly.\n"
        "- PRIORITY 2: Use user-uploaded images listed below when relevant.\n"
        "- PRIORITY 3: Only fall back to placeholders (placehold.co) when no real image is available.\n"
        "- Never invent or guess image URLs. Only use URLs explicitly listed here.\n\n"
        "Preview compatibility policy:\n"
        "- Always include index.html as preview entrypoint.\n"
        "- If you create CSS or JS, reference them from index.html using relative paths.\n"
        "- Avoid framework-only outputs without an HTML entrypoint.\n\n"
        f"Pexels stock photos (use these as <img src> in the site):\n{pexels_block}\n\n"
        f"User-uploaded images:\n{image_library_block}\n\n"
        "Conversation:\n\n"
        f"{transcript or '(empty conversation)'}"
    )

    prompt_parts: list[types.Part] = [types.Part.from_text(text=user_prompt)]
    for index, image_part in enumerate(_inline_image_parts_from_attachments(attachments), start=1):
        prompt_parts.append(types.Part.from_text(text=f"Reference image #{index} from user upload:"))
        prompt_parts.append(image_part)

    return [
        types.Content(
            role="user",
            parts=prompt_parts,
        )
    ]


def _build_client() -> genai.Client:
    api_key = (settings.GOOGLE_CLOUD_API_KEY or settings.GOOGLE_API_KEY or "").strip()
    project = (settings.GOOGLE_CLOUD_PROJECT or "").strip()
    location = (settings.GOOGLE_CLOUD_LOCATION or "us-central1").strip() or "us-central1"

    if project:
        resolved = ensure_google_application_credentials(settings.GOOGLE_CREDENTIALS_JSON)
        if not resolved:
            raise GeminiStreamError(
                "Credenciais Vertex ausentes. Configure GOOGLE_APPLICATION_CREDENTIALS, "
                "execute 'gcloud auth application-default login', ou defina GOOGLE_CREDENTIALS_JSON."
            )
        # Vertex mode uses project/location + ADC credentials.
        return genai.Client(vertexai=True, project=project, location=location)

    if not api_key:
        raise GeminiStreamError(
            "Configure GOOGLE_CLOUD_PROJECT (Vertex) ou GOOGLE_CLOUD_API_KEY/GOOGLE_API_KEY (Developer API)."
        )

    # Developer API mode when API key is available.
    return genai.Client(vertexai=False, api_key=api_key)


def _build_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=settings.NOVIDADE_GEMINI_MAX_OUTPUT_TOKENS,
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
        tools=[types.Tool(google_search=types.GoogleSearch())],
        system_instruction=[types.Part.from_text(text=SYSTEM_PROMPT)],
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )


async def stream_gemini_code(
    *,
    messages: list[dict[str, str]],
    codebase_info: str,
    attachments: list[dict[str, Any]] | None = None,
    workspace_image_urls: list[str] | None = None,
    pexels_image_urls: list[str] | None = None,
) -> AsyncIterator[str]:
    client = _build_client()
    contents = _gemini_contents(messages, codebase_info, attachments, workspace_image_urls, pexels_image_urls)
    config = _build_config()
    model = (settings.NOVIDADE_GEMINI_MODEL or "gemini-2.5-flash-lite").strip() or "gemini-2.5-flash-lite"

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()

    def _runner() -> None:
        try:
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=config,
            ):
                text = chunk.text
                if text:
                    loop.call_soon_threadsafe(queue.put_nowait, ("text", text))
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))
        except Exception as exc:
            logger.exception("Gemini stream failed")
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))

    worker = Thread(target=_runner, daemon=True)
    worker.start()

    while True:
        event, data = await queue.get()
        if event == "text" and data:
            yield data
            continue
        if event == "error":
            raise GeminiStreamError(data or "Falha no streaming Gemini.")
        if event == "done":
            break
