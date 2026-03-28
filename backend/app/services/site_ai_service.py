"""
services/site_ai_service.py
Criar site — Groq via client OpenAI (base_url https://api.groq.com/openai/v1).

- Priorité : ``client.responses.create`` (instructions + input → ``output_text``), comme la doc Groq/OpenAI.
- Secours : ``chat.completions`` si l’API ``/responses`` n’est pas disponible côté Groq.

Aucun appel Google Gemini pour ce module (remplace GEMINI_TEXT / GEMINI_SITE_GENERATION pour chat + JSON).
Les images « AI Studio / Marketing » restent Replicate (autre endpoint) ; pas ici.
"""
from __future__ import annotations

import asyncio
import json
import logging
from functools import partial
from typing import Any

from openai import APIConnectionError, APIStatusError, OpenAI, RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)

_GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def build_site_generation_brief_from_prompts(prompts: list[Any]) -> str:
    """
    Brief envoyé au modèle de structure : conversation complète.
    Avant : seuls les messages user étaient concaténés — les précisions convenues avec
    Laurena (assistant) étaient perdues, donc les itérations « améliore le hero » ne
    pouvaient pas être appliquées correctement.
    """
    if not prompts:
        return ""
    ordered = sorted(prompts, key=lambda p: p.created_at)
    chunks: list[str] = []
    for p in ordered:
        if getattr(p, "role", None) not in ("user", "assistant"):
            continue
        who = "User" if p.role == "user" else "Assistant (Laurena)"
        chunks.append(f"{who}:\n{str(p.content).strip()}")
    if not chunks:
        return ""
    return (
        "SITE GENERATION BRIEF — Full conversation. The JSON site generator MUST honor "
        "the latest User messages for changes and corrections. Lines labeled Assistant (Laurena) "
        "are agreed refinements, tone, and structure notes from the chat phase — treat them "
        "as binding constraints together with User messages.\n\n"
        + "\n\n---\n\n".join(chunks)
    )


class GeminiGenerationError(Exception):
    """Réponse bloquée, vide ou invalide — nom conservé pour les routes / worker existants."""

    def __init__(self, user_message: str, *, reason: str = "unknown") -> None:
        self.user_message = user_message
        self.reason = reason
        super().__init__(user_message)


def _msg_empty_or_model_stop() -> str:
    return (
        "A IA nÃ£o devolveu texto. Tente reformular o pedido ou aguarde um momento e tente novamente."
    )


def _groq_client() -> OpenAI:
    key = (settings.GROQ_API_KEY or "").strip()
    if not key:
        raise RuntimeError(
            "GROQ_API_KEY nÃ£o estÃ¡ definido. Adicione a chave no .env para o Criar site."
        )
    return OpenAI(api_key=key, base_url=_GROQ_BASE_URL)


def _groq_handle_errors(exc: BaseException, *, context: str) -> None:
    if isinstance(exc, RateLimitError):
        logger.warning("Groq [%s] rate limit: %s", context, exc)
        raise GeminiGenerationError(
            "Limite de pedidos à IA atingida. Aguarde um minuto e tente novamente.",
            reason="rate_limit",
        ) from exc
    if isinstance(exc, APIConnectionError):
        logger.exception("Groq [%s] connection error", context)
        raise GeminiGenerationError(
            "Erro de ligaçÃ£o à IA. Tente novamente dentro de alguns minutos.",
            reason="api_error",
        ) from exc
    if isinstance(exc, APIStatusError):
        logger.exception("Groq [%s] HTTP error", context)
        detail = getattr(exc, "message", None) or str(exc)
        if exc.status_code == 401:
            raise GeminiGenerationError(
                "Chave da API Groq invÃ¡lida (GROQ_API_KEY). Verifique o .env.",
                reason="auth",
            ) from exc
        raise GeminiGenerationError(
            f"Erro da IA ({exc.status_code}): {detail}",
            reason="api_error",
        ) from exc


def _text_from_response_object(resp: Any) -> str:
    out = getattr(resp, "output_text", None)
    if isinstance(out, str) and out.strip():
        return out.strip()
    return ""


def _responses_api_unsupported(exc: APIStatusError) -> bool:
    b = str(exc).lower()
    if exc.status_code in (404, 405):
        return True
    return "response" in b and ("not found" in b or "unknown" in b or "invalid" in b)


def _responses_output_parse_failed(exc: APIStatusError) -> bool:
    """
    Groq /responses sometimes returns 400 output_parse_failed (model output not parseable
    by the API). chat.completions does not hit that path — fall back.
    """
    if exc.status_code != 400:
        return False
    code = getattr(exc, "code", None)
    if code == "output_parse_failed":
        return True
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and err.get("code") == "output_parse_failed":
            return True
    msg = (getattr(exc, "message", None) or str(exc)).lower()
    if "output_parse_failed" in msg or "could not be parsed" in msg:
        return True
    return False


def _sync_groq_responses_create(
    *,
    instructions: str,
    user_input: str,
    model: str,
    max_output_tokens: int,
    temperature: float,
    context: str,
) -> str:
    """Groq: POST .../responses via SDK (équivalent doc utilisateur)."""
    client = _groq_client()
    try:
        resp = client.responses.create(
            model=model,
            instructions=instructions,
            input=user_input,
            max_output_tokens=max_output_tokens,
            temperature=temperature,
        )
    except APIStatusError as exc:
        if _responses_api_unsupported(exc):
            raise
        if _responses_output_parse_failed(exc):
            # Caller (_sync_groq_completion) falls back to chat.completions.
            raise
        _groq_handle_errors(exc, context=context)
    except (RateLimitError, APIConnectionError) as exc:
        _groq_handle_errors(exc, context=context)
    except Exception as exc:
        logger.exception("Groq [%s] responses.create failed", context)
        raise GeminiGenerationError(
            "Erro ao contactar a IA. Tente novamente dentro de alguns minutos.",
            reason="api_error",
        ) from exc

    text = _text_from_response_object(resp)
    if not text:
        logger.warning("Groq [%s] empty output_text from responses.create", context)
        raise GeminiGenerationError(_msg_empty_or_model_stop(), reason="empty_response")
    return text


def _sync_groq_chat_completions(
    messages: list[dict[str, str]],
    *,
    model: str,
    max_tokens: int,
    temperature: float,
    context: str,
) -> str:
    client = _groq_client()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    except (RateLimitError, APIConnectionError, APIStatusError) as exc:
        _groq_handle_errors(exc, context=context)
        raise
    except Exception as exc:
        logger.exception("Groq [%s] chat.completions failed", context)
        raise GeminiGenerationError(
            "Erro ao contactar a IA. Tente novamente dentro de alguns minutos.",
            reason="api_error",
        ) from exc

    choice = resp.choices[0] if resp.choices else None
    text = (choice.message.content or "").strip() if choice and choice.message else ""
    if not text:
        logger.warning("Groq [%s] empty chat completion", context)
        raise GeminiGenerationError(_msg_empty_or_model_stop(), reason="empty_response")
    return text


def _split_system_and_rest(
    messages: list[dict[str, str]],
) -> tuple[str, list[dict[str, str]]]:
    if messages and messages[0].get("role") == "system":
        return str(messages[0].get("content", "")), messages[1:]
    return "", messages


def _dialog_string_from_turns(turns: list[dict[str, str]]) -> str:
    parts: list[str] = []
    for m in turns:
        role = m.get("role", "user")
        if role not in ("user", "assistant"):
            continue
        label = "User" if role == "user" else "Assistant"
        parts.append(f"{label}: {str(m.get('content', '')).strip()}")
    return "\n\n".join(parts)


def _sync_groq_completion(
    messages: list[dict[str, str]],
    *,
    model: str,
    max_tokens: int,
    temperature: float,
    context: str,
) -> str:
    instructions, rest = _split_system_and_rest(messages)
    user_input = (
        rest[0].get("content", "").strip()
        if len(rest) == 1 and rest[0].get("role") == "user"
        else _dialog_string_from_turns(rest)
    )
    if not instructions.strip():
        # Pas de système : tout en input (rare)
        user_input = _dialog_string_from_turns(messages)

    try:
        return _sync_groq_responses_create(
            instructions=instructions.strip() or "You are a helpful assistant.",
            user_input=user_input,
            model=model,
            max_output_tokens=max_tokens,
            temperature=temperature,
            context=context,
        )
    except APIStatusError as exc:
        if _responses_api_unsupported(exc):
            logger.warning(
                "Groq [%s] responses API indisponÃ­vel (%s); fallback chat.completions.",
                context,
                exc.status_code,
            )
            return _sync_groq_chat_completions(
                messages,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                context=context,
            )
        if _responses_output_parse_failed(exc):
            logger.warning(
                "Groq [%s] responses API output_parse_failed; fallback chat.completions.",
                context,
            )
            return _sync_groq_chat_completions(
                messages,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                context=context,
            )
        _groq_handle_errors(exc, context=context)


SITE_SYSTEM_PROMPT = """\
You are an expert web designer. The user input is a **full chat transcript** (User + Assistant).
Apply the latest User requests for edits; Assistant (Laurena) lines are agreed refinements.
You MUST reply with a single JSON object (no markdown fences, no extra text).

## STRUCTURE LOCK (critical)
- Do **not** add, remove, or rename keys in the canonical `site` schema for the chosen `template_id`.
- Do **not** omit listed keys: use "" or short sensible defaults if a detail is unknown.
- Adapt **copy**, **image URLs**, and **tipografia** (font *names* only for hotel/ecommerce) to the user's taste — **not** page background colours or global palette (see COLOUR LOCK below).
- For **landing-placeholders** and **advertising-agency**: never output `html_template`, **`theme`**, or invented placeholder keys.

## COLOUR / THEME LOCK
- **hotel-reserva** & **ecommerce**: set **design.paleta** to `{}` (empty object). The renderer uses **fixed** palette and backgrounds. You may still set **design.tipografia** (Google Font *names* for display/body).
- **portfolio**: omit **color** on each project or use `""` — card accents are **fixed** in the engine. Optional **design.typographie** only (no palette).
- **landing-placeholders** & **advertising-agency**: **no** `theme` key — CSS colours are **frozen** in the template file.

## Output shape (always)
{
  "template_id": "hotel-reserva" | "ecommerce" | "portfolio" | "landing-placeholders" | "advertising-agency",
  "site": { ... }
}

## How to choose template_id (pick exactly ONE)
- **hotel-reserva** — hotels, travel, bookings, stays, destinations, reservations.
- **ecommerce** — shop, fashion, products, catalog, cart, retail, clothing.
- **portfolio** — personal site, CV, developer/designer portfolio, freelance, case studies.
- **landing-placeholders** — luxury / dark single-page marketing (creative studio, personal brand, high-end services)
  with fixed navbar–hero–features–stats–testimonials–cta–footer; use when the brief fits this narrative arc and not a shop/hotel/portfolio multi-case layout.
- **advertising-agency** — creative / ad agency, brutalist editorial, bold Bebas-style headlines, split hero with **animated ticker** (CSS fixed; you only fill **TICKER_TEXT** and other placeholders).

The **site** object MUST follow the canonical structure for that template (keys and nested shapes below).
Respect section **order** and **tipo** / **type** values so the renderer can map them.

---

### A) template_id = "hotel-reserva" (Portuguese copy: idioma "pt-BR")
Top-level: id, nome, tipo, idioma, arquivo, design, secoes[], optional modal_reserva.

- **design**: estetica, tema, **paleta** { cream, sand, brown, dark, gold, gold_light, white, muted } (HEX),
  **tipografia** { display, corpo } (Google Font names, e.g. "Playfair Display (serif)", "DM Sans (sans-serif)").

- **secoes[]** each has **id** (kebab-case) and **tipo**:
  - **navegacao**: logo, links (array of label strings), cta
  - **hero**: layout, tag, titulo, subtitulo, botoes[], badge { nota, estrelas, avaliacoes }, **imagem** (URL placeholder OK),
    optional **photo_search_query** (English) on the same object for stock
  - **formulario_busca**: campos[], botao
  - **grid_destinos**: titulo, tag, destinos[] { cidade, hoteis, imagem, photo_search_query? }
  - **grid_produtos**: titulo, tag, hoteis[] { nome, badge, nota, localizacao, features[], preco_por_noite, moeda, imagem }
  - **features**: titulo, tag, stat_destaque, items[] { icone, titulo, descricao }
  - **testimonials**: titulo, tag, depoimentos[] { nota, texto, autor, cidade, avatar }
  - **newsletter**: titulo, subtitulo, placeholder, botao
  - **footer**: logo, descricao, colunas[] { titulo, links[] (strings or {label,href}) }, copyright

- **modal_reserva** (optional): titulo, campos[], botao_confirmar

---

### B) template_id = "ecommerce" (Portuguese: idioma "pt-BR")
- **design.paleta**: MUST be `{}` (empty — all colours fixed in the renderer).
- **design.tipografia**: display, corpo, mono (optional).
- **secoes[]** **tipo**:
  - **banner_animado**: keep this block first with `mensagens` as 2–4 short PT strings if you want a valid tree; **the live site ticker text is fixed in the renderer and does not change from your strings** (carousel/bandeau non modifiable côté rendu).
  - **navegacao**: logo, categorias[] (strings OR { "label", "href"/"url" }), features[] (hints)
  - **hero**: label_colecao (optional **label**), titulo, subtitulo, **botoes** as strings OR objects
    `{ "label", "href" or "url", "primario" or "primary" (boolean) }`, **stats** as `{ "valor" or "value", "label" }`,
    imagem (optional)
  - **barra_filtros**: filtros[], ordenacao[]
  - **grid_produtos**: colunas (optional), produtos[] { nome, marca, badge, preco, preco_original?, desconto_pct?, moeda, categorias[], cores[], imagem }
  - **banner_promocional**: tag, titulo, subtitulo, countdown (bool), duracao_horas, imagem
  - **brand_strip**: titulo, marcas[]
  - **editorial_grid**: principal { titulo, subtitulo, cta, imagem }, secundarios[] { titulo, sub, imagem }
  - **features_strip**: colunas, items[] { icone, titulo, descricao }
  - **footer**: logo, descricao, redes_sociais[], colunas[], meios_pagamento[], copyright

---

### C) template_id = "portfolio" (single structured object `site`, no `sections[]`)
The **site** root MUST use exactly this shape (keys required; arrays may be empty only if nothing to show):

- **meta**: { **siteTitle**, **siteDescription**, **lang** (e.g. "fr"), **favicon** (single Unicode glyph or short symbol for kicker, e.g. "✦") }
- **hero**: { **firstName**, **lastName**, **title**, **tagline**, **ctaLabel**, **ctaAnchor** (e.g. "#projets") }
- **about**: { **heading**, **bio** (long string), **skills** [ strings ], **availability** }
- **projects**: [ { **id**, **title**, **category**, **year**, **description**, **tags** [ strings ], **color** omit or `""` (fixed in renderer), **image** (optional https URL or empty), **photo_search_query** (optional English; same object as **image** when image is placeholder) } ]
- **services**: [ { **icon** (short text e.g. "Aa" or "◈"), **title**, **description** } ]
- **contact**: { **heading**, **subheading**, **email**, **phone**, **location**, **social**: [ { **label**, **url** } ] }
- **footer**: { **copyright**, **madeWith** }

Optional **design.typographie**: { **display**, **corps** } — Google Font names; only these may tune fonts (no palette / background overrides for portfolio — the renderer fixes layout colours).

Copy language: follow **meta.lang** (default French for portfolio unless the user asks otherwise).

---

### D) template_id = "landing-placeholders" (single page, HTML fixed in engine)
The `site` object MUST contain **only**:
- **lang** (optional, default `"fr"`): HTML `lang` attribute.
- **placeholders**: object with **exactly** these keys (all strings; fill from the brief; use "" only if unavoidable):
  CTA_BTN_PRIMARY, CTA_BTN_SECONDARY, CTA_DESC, CTA_LABEL, CTA_TITLE,
  FEATURES_DESC, FEATURES_LABEL, FEATURES_TITLE,
  FEATURE_1_DESC, FEATURE_1_ICON, FEATURE_1_TITLE,
  FEATURE_2_DESC, FEATURE_2_ICON, FEATURE_2_TITLE,
  FEATURE_3_DESC, FEATURE_3_ICON, FEATURE_3_TITLE,
  FOOTER_COPY, FOOTER_LINK_1, FOOTER_LINK_2, FOOTER_LINK_3,
  HERO_BTN_PRIMARY, HERO_BTN_SECONDARY, HERO_EYEBROW, HERO_SUBTITLE, HERO_TITLE_ACCENT, HERO_TITLE_LINE1, HERO_TITLE_LINE2,
  LOGO_TEXT, NAV_CTA, NAV_LINK_1, NAV_LINK_2, NAV_LINK_3, SITE_TITLE,
  STAT_1_LABEL, STAT_1_NUMBER, STAT_2_LABEL, STAT_2_NUMBER, STAT_3_LABEL, STAT_3_NUMBER,
  TESTIMONIALS_LABEL, TESTIMONIALS_TITLE,
  TESTIMONIAL_1_AVATAR, TESTIMONIAL_1_NAME, TESTIMONIAL_1_ROLE, TESTIMONIAL_1_TEXT,
  TESTIMONIAL_2_AVATAR, TESTIMONIAL_2_NAME, TESTIMONIAL_2_ROLE, TESTIMONIAL_2_TEXT,
  TESTIMONIAL_3_AVATAR, TESTIMONIAL_3_NAME, TESTIMONIAL_3_ROLE, TESTIMONIAL_3_TEXT
Do **not** output `meta`, `html_template`, **`theme`**, or any other top-level keys under `site`.

---

### E) template_id = "advertising-agency" (brutalist / editorial, HTML fixed in engine)
The `site` object MUST contain **only**:
- **lang** (optional, default `"fr"`).
- **placeholders** with **exactly** these keys (all strings):
  CLIENTS_LABEL, CLIENT_1, CLIENT_2, CLIENT_3, CLIENT_4, CLIENT_5,
  CTA_BTN, CTA_LINE1, CTA_LINE2, CTA_SUB,
  FOOTER_CITY, FOOTER_COL1_L1, FOOTER_COL1_L2, FOOTER_COL1_L3, FOOTER_COL1_L4, FOOTER_COL1_TITLE,
  FOOTER_COL2_L1, FOOTER_COL2_L2, FOOTER_COL2_L3, FOOTER_COL2_TITLE, FOOTER_COL3_TITLE,
  FOOTER_COPY, FOOTER_EMAIL, FOOTER_PHONE, FOOTER_TAGLINE,
  HERO_BADGE, HERO_BTN1, HERO_BTN2, HERO_DESC, HERO_EMOJI, HERO_LINE1, HERO_LINE2, HERO_LINE3, HERO_TAG,
  LOGO_ACCENT, LOGO_PART1, NAV_1, NAV_2, NAV_3, NAV_CONTACT,
  PORTFOLIO_TAG, PORTFOLIO_TITLE, PROCESS_TAG, PROCESS_TITLE,
  SERVICES_LINK, SERVICES_TAG, SERVICES_TITLE,
  SERVICE_1_NAME, SERVICE_1_TAG1, SERVICE_1_TAG2,
  SERVICE_2_NAME, SERVICE_2_TAG1, SERVICE_2_TAG2,
  SERVICE_3_NAME, SERVICE_3_TAG1, SERVICE_3_TAG2,
  SERVICE_4_NAME, SERVICE_4_TAG1, SERVICE_4_TAG2,
  SITE_TITLE,
  STEP_1_DESC, STEP_1_TITLE, STEP_2_DESC, STEP_2_TITLE, STEP_3_DESC, STEP_3_TITLE, STEP_4_DESC, STEP_4_TITLE,
  TICKER_TEXT,
  WORK_1_CAT, WORK_1_EMOJI, WORK_1_NAME, WORK_2_CAT, WORK_2_EMOJI, WORK_2_NAME, WORK_3_CAT, WORK_3_EMOJI, WORK_3_NAME
The hero **ticker** animation is defined in CSS; you only provide the repeating **TICKER_TEXT** phrase — do **not** output `theme` or `html_template`.

---

## Global rules
- For **ecommerce** buttons and nav links: use JSON **objects** `{ "label": "...", "href": "#id" }` when you need custom anchors — never output Python-style repr text; the renderer maps **primario** / **primary** for button style. For **portfolio**, set **hero.ctaAnchor** to hash anchors only (e.g. `#projets`, `#about`, `#contact`).
- ONE static index page; hotel/ecommerce use **#section-id** per section **id**. Portfolio uses fixed section ids: #about, #projets, #services, #contact.
- **Colours**: follow **COLOUR / THEME LOCK** — no AI-driven background or global palette for hotel, ecommerce, portfolio, or placeholder templates.
- **Fonts (hotel/ecommerce only)**: you may tune **design.tipografia** / **typographie** with Google Font *names*; do not try to change colours via JSON.
- **Images**: you MAY use temporary https://images.unsplash.com/... URLs OR leave **imagem** / **image** empty; the pipeline replaces them with **Pexels** using **photo_search_query** when present.
  On every object that contains **imagem** / **image** / **photo** / **avatar**, add **photo_search_query** (English, 4–12 words: subject, setting, mood) on the **same object**.
- ALL user-facing copy must match the page language: **idioma** / **langue** for hotel/ecommerce; **meta.lang** for portfolio; **lang** for **landing-placeholders** and **advertising-agency**.
- **photo_search_query** values are always English (stock API).
- No base64 images. No root-relative internal URLs like "/loja" — use "#id-de-section".
- **Encoding**: Output MUST be valid UTF-8. Every user-facing string in **site** MUST use real Unicode characters
  (accents, cedillas, etc.); use JSON string escaping only as JSON requires, not HTML entities for ordinary text.
- Return ONLY valid JSON, nothing else."""


def _sync_generate_site_structure(brief: str) -> dict:
    model = (settings.GROQ_SITE_STRUCTURE_MODEL or "openai/gpt-oss-20b").strip()
    messages = [
        {"role": "system", "content": SITE_SYSTEM_PROMPT},
        {"role": "user", "content": brief},
    ]
    raw = _sync_groq_completion(
        messages,
        model=model,
        max_tokens=16384,
        temperature=0.7,
        context="site_structure",
    )

    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    try:
        structure = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Groq returned invalid JSON: %s… — %s", raw[:300], exc)
        raise GeminiGenerationError(
            "A IA devolveu um formato invÃ¡lido. Tente gerar o site novamente.",
            reason="invalid_json",
        ) from exc

    tid = (structure.get("template_id") or "").strip()
    has_triple = tid in (
        "hotel-reserva",
        "ecommerce",
        "portfolio",
        "landing-placeholders",
        "advertising-agency",
    ) and isinstance(structure.get("site"), dict)
    has_legacy = isinstance(structure.get("sections"), list) and len(structure.get("sections") or []) > 0
    has_framework = bool(structure.get("projectInfo")) and bool(structure.get("page"))
    if not has_legacy and not has_framework and not has_triple:
        raise GeminiGenerationError(
            "A IA devolveu uma estrutura incompleta. Tente reformular o briefing.",
            reason="missing_sections",
        )

    return structure


def _sync_chat_reply(messages: list[dict], latest_user: str) -> str:
    del latest_user  # historique déjà dans messages
    model = (settings.GROQ_SITE_CHAT_MODEL or "openai/gpt-oss-20b").strip()

    system_text = (
        "You are Laurena (chat / brief refinement), inside Laurena Studio. "
        "Another model fills a fixed JSON schema when the user clicks « Gerar site » — it must not change key names or page structure, only content and styling fields allowed by that template. "
        "CRITICAL PRODUCT FACTS (never contradict): "
        "« Gerar site » builds a REAL multi-section static site (HTML+CSS+JS), preview + ZIP. "
        "You do NOT output full HTML in chat — you refine the brief in natural language. "
        "ITERATION: After a preview exists, when the user asks to change colours, sections, copy, or layout, "
        "acknowledge the change clearly and concretely (what will differ). "
        "Always remind them to click « Gerar site » again so the generator applies the update — "
        "chat alone does not change the live preview. "
        "NEVER say you cannot build a website; the app generates it. "
        "Prefer short answers (2–5 sentences). Do NOT chain many clarifying questions. "
        "If the user says “don’t ask”, “just create”, “go”, commit with invented details, "
        "then tell them to click « Gerar site » for the preview. "
        "If they ask where the site is, say it appears after « Gerar site », then Preview. "
        "Reply in the SAME language the user writes in. "
        "Always output plain UTF-8 Unicode: use real accented letters (ã, ç, é, ê, í, ó, ô, ú, à, etc.) "
        "when writing Portuguese, French, or other Latin scripts. Do not use HTML entities for normal words "
        "and do not output mojibake or replacement characters (U+FFFD)."
    )

    openai_messages: list[dict[str, str]] = [{"role": "system", "content": system_text}]
    for msg in messages:
        role = msg.get("role", "user")
        if role not in ("user", "assistant"):
            continue
        openai_messages.append({"role": role, "content": str(msg.get("content", ""))})

    text = _sync_groq_completion(
        openai_messages,
        model=model,
        max_tokens=512,
        temperature=0.8,
        context="chat",
    )
    return text or "Pode continuar a descrever o site."


async def generate_site_structure(brief: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, partial(_sync_generate_site_structure, brief))


async def generate_chat_reply(messages: list[dict], latest_user: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, partial(_sync_chat_reply, messages, latest_user)
    )
