"""
services/site_ai_service.py
Gemini integration for site-builder: takes user brief and returns a
structured JSON describing the full site (sections, content, SEO).
"""
import asyncio
import json
import logging
from functools import partial

from google.genai import types

from app.core.config import settings
from app.services.ai_service import _get_client

_GEMINI_TEXT = settings.GEMINI_TEXT_MODEL

logger = logging.getLogger(__name__)

SITE_SYSTEM_PROMPT = """\
You are an expert web designer and developer.
The user describes a website they want to build.
You MUST reply with a single JSON object (no markdown fences, no extra text).

JSON schema:
{
  "site_name": "string",
  "description": "string (SEO meta description)",
  "primary_color": "#hex",
  "font": "string (Google Font name)",
  "sections": [
    {
      "type": "hero" | "features" | "about" | "pricing" | "faq" | "gallery" | "menu" | "testimonials" | "contact" | "cta" | "footer" | "custom",
      "heading": "string",
      "subheading": "string (optional)",
      "items": [
        {
          "title": "string",
          "text": "string",
          "icon": "string (Lucide icon name, optional)",
          "price": "string (optional)",
          "image_prompt": "string (optional, prompt to generate an image for this item)"
        }
      ],
      "cta_text": "string (optional)",
      "cta_url": "string (optional)",
      "background": "light" | "dark" | "primary" | "gradient"
    }
  ]
}

Rules:
- Include at least: hero, one content section, and footer.
- Generate realistic placeholder text (not lorem ipsum).
- Adapt the structure to the user's industry.
- ALL text must be in the SAME language the user wrote in.
- This ships as ONE static index.html (no extra pages). For cta_url: use "#" or "#section-id"
  for fake navigation, or a full https:// URL for a real external link. NEVER use root-relative
  paths like "/shop" or "/contact" — they break the preview.
- Return ONLY valid JSON, nothing else."""


def _build_site_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        temperature=0.7,
        top_p=0.9,
        max_output_tokens=8192,
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
        system_instruction=[types.Part.from_text(text=SITE_SYSTEM_PROMPT)],
    )


def _sync_generate_site_structure(brief: str) -> dict:
    """Blocking Gemini call that returns parsed JSON structure."""
    client = _get_client()
    config = _build_site_config()

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=brief)],
        ),
    ]

    text_parts: list[str] = []
    for chunk in client.models.generate_content_stream(
        model=_GEMINI_TEXT,
        contents=contents,
        config=config,
    ):
        if not chunk.candidates:
            continue
        for part in chunk.candidates[0].content.parts:
            if part.text:
                text_parts.append(part.text)

    raw = "".join(text_parts).strip()

    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    try:
        structure = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned invalid JSON: %s… — %s", raw[:300], exc)
        raise ValueError(f"AI returned invalid JSON: {exc}") from exc

    if "sections" not in structure:
        raise ValueError("AI response missing 'sections' key")

    return structure


def _sync_chat_reply(messages: list[dict], latest_user: str) -> str:
    """Chat Laurena — must align with the real “Gerar site” product (HTML/CSS généré)."""
    client = _get_client()

    system_text = (
        "You are Laurena, the site-building assistant inside Laurena Studio. "
        "CRITICAL PRODUCT FACTS (never contradict): "
        "The user can click the button « Gerar site » (or “Gerar site”) in the app. "
        "That action generates a REAL multi-section static website: one HTML file with "
        "embedded CSS (responsive) and light JavaScript (e.g. contact form). "
        "They get a browser preview and a ZIP download. "
        "You do NOT output full HTML in chat. You help refine the brief in natural language. "
        "NEVER say you cannot build a website, never say sites are only imaginary or that you "
        "only describe without producing something real—generation is done by the app. "
        "BEHAVIOUR: Prefer short answers (2–4 sentences). "
        "Do NOT ask one clarifying question after another. "
        "If the user says things like “don’t ask”, “invent it”, “just create”, “no more questions”, "
        "“go”, “make it”, immediately commit: invent brand name, sections, tone, colours in prose, "
        "then tell them to click « Gerar site » now to generate the live preview. "
        "If they ask “where is the site” / “cadê o site”, explain the site is generated when they "
        "click « Gerar site », then open Preview. "
        "Reply in the SAME language the user writes in."
    )

    config = types.GenerateContentConfig(
        temperature=0.8,
        top_p=0.9,
        max_output_tokens=512,
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
        system_instruction=[types.Part.from_text(text=system_text)],
    )

    contents: list[types.Content] = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )

    text_parts: list[str] = []
    for chunk in client.models.generate_content_stream(
        model=_GEMINI_TEXT,
        contents=contents,
        config=config,
    ):
        if not chunk.candidates:
            continue
        for part in chunk.candidates[0].content.parts:
            if part.text:
                text_parts.append(part.text)

    return "".join(text_parts).strip() or "Pode continuar a descrever o site."


async def generate_site_structure(brief: str) -> dict:
    """Async wrapper: returns parsed JSON site structure from Gemini."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, partial(_sync_generate_site_structure, brief)
    )


async def generate_chat_reply(messages: list[dict], latest_user: str) -> str:
    """Async wrapper: returns a conversational reply from Gemini."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, partial(_sync_chat_reply, messages, latest_user)
    )
