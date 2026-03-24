"""
services/site_ai_service.py
Gemini integration for site-builder: takes user brief and returns a
structured JSON describing the full site (sections, content, SEO).
"""
import asyncio
import json
import logging
from collections.abc import Iterator
from functools import partial
from typing import Any

from google.genai import types

from app.core.config import settings
from app.services.ai_service import _get_client

_GEMINI_TEXT = settings.GEMINI_TEXT_MODEL
# Modèle utilisé uniquement pour la génération de la structure JSON du site (Gerar site), pas pour le chat.
_GEMINI_SITE_STRUCTURE = settings.GEMINI_SITE_GENERATION_MODEL

logger = logging.getLogger(__name__)

# Filtros de segurança ativos (substitui OFF). Equilíbrio entre proteção e falsos positivos.
_GEMINI_SAFETY_THRESHOLD = types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE


def _gemini_safety_settings() -> list[types.SafetySetting]:
    return [
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold=_GEMINI_SAFETY_THRESHOLD,
        ),
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold=_GEMINI_SAFETY_THRESHOLD,
        ),
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold=_GEMINI_SAFETY_THRESHOLD,
        ),
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold=_GEMINI_SAFETY_THRESHOLD,
        ),
    ]


class GeminiGenerationError(Exception):
    """Resposta bloqueada, vazia ou inválida — mensagem já adequada ao utilizador (PT)."""

    def __init__(self, user_message: str, *, reason: str = "unknown") -> None:
        self.user_message = user_message
        self.reason = reason
        super().__init__(user_message)


def _msg_prompt_blocked() -> str:
    return (
        "O seu pedido não pôde ser processado pelos filtros de segurança. "
        "Reformule o briefing sem conteúdo ofensivo, ilegal ou perigoso e tente novamente."
    )


def _msg_output_blocked() -> str:
    return (
        "A resposta foi bloqueada pelos filtros de segurança. "
        "Ajuste a descrição do site e tente novamente."
    )


def _msg_empty_or_model_stop() -> str:
    return (
        "A IA não devolveu texto. Tente reformular o pedido ou aguarde um momento e tente novamente."
    )


def _collect_stream_text(
    stream: Iterator[types.GenerateContentResponse],
    *,
    context: str,
) -> str:
    """
    Agrega texto do stream e trata prompt bloqueado, finish_reason e resposta vazia.
    `context` é só para logs (ex.: "chat", "site_structure").
    """
    text_parts: list[str] = []
    last_finish: types.FinishReason | None = None

    for chunk in stream:
        if chunk.prompt_feedback:
            pf = chunk.prompt_feedback
            br = pf.block_reason
            if br is not None and br != types.BlockedReason.BLOCKED_REASON_UNSPECIFIED:
                logger.warning(
                    "Gemini [%s] prompt_feedback block_reason=%s message=%s",
                    context,
                    br,
                    getattr(pf, "block_reason_message", None),
                )
                raise GeminiGenerationError(_msg_prompt_blocked(), reason="prompt_blocked")

        if not chunk.candidates:
            continue

        cand = chunk.candidates[0]
        if cand.finish_reason is not None:
            last_finish = cand.finish_reason

        content = cand.content
        if content and content.parts:
            for part in content.parts:
                if part.text:
                    text_parts.append(part.text)

    raw = "".join(text_parts).strip()
    if raw:
        return raw

    # Resposta vazia: interpretar finish_reason
    fr = last_finish
    if fr in (
        types.FinishReason.SAFETY,
        types.FinishReason.PROHIBITED_CONTENT,
        types.FinishReason.IMAGE_SAFETY,
        types.FinishReason.IMAGE_PROHIBITED_CONTENT,
    ):
        logger.warning("Gemini [%s] empty output finish_reason=%s", context, fr)
        raise GeminiGenerationError(_msg_output_blocked(), reason="output_blocked")

    if fr == types.FinishReason.MAX_TOKENS:
        raise GeminiGenerationError(
            "A resposta da IA foi cortada por limite de tamanho. Use um briefing mais curto ou divida em passos.",
            reason="max_tokens",
        )

    if fr == types.FinishReason.RECITATION:
        raise GeminiGenerationError(
            "A IA não pôde concluir a resposta por restrições de conteúdo. Reformule o pedido.",
            reason="recitation",
        )

    logger.warning("Gemini [%s] empty text, finish_reason=%s", context, fr)
    raise GeminiGenerationError(_msg_empty_or_model_stop(), reason="empty_response")


SITE_SYSTEM_PROMPT = """\
You are an expert web designer. The user describes a one-page static site.
You MUST reply with a single JSON object (no markdown fences, no extra text).

## Output shape (always)
{
  "template_id": "hotel-reserva" | "ecommerce" | "portfolio",
  "site": { ... }
}

## How to choose template_id (pick exactly ONE)
- **hotel-reserva** — hotels, travel, bookings, stays, destinations, reservations.
- **ecommerce** — shop, fashion, products, catalog, cart, retail, clothing.
- **portfolio** — personal site, CV, developer/designer portfolio, freelance, case studies.

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
- **design.paleta**: bg, surface, surface2, border, lime, lime_dim, white, muted, muted2, red (HEX).
- **design.tipografia**: display, corpo, mono (optional).
- **secoes[]** **tipo**:
  - **banner_animado**: mensagens[] (ticker)
  - **navegacao**: logo, categorias[], features[] (hints)
  - **hero**: label_colecao, titulo, subtitulo, botoes[], stats[] { valor, label }, imagem (optional)
  - **barra_filtros**: filtros[], ordenacao[]
  - **grid_produtos**: colunas (optional), produtos[] { nome, marca, badge, preco, preco_original?, desconto_pct?, moeda, categorias[], cores[], imagem }
  - **banner_promocional**: tag, titulo, subtitulo, countdown (bool), duracao_horas, imagem
  - **brand_strip**: titulo, marcas[]
  - **editorial_grid**: principal { titulo, subtitulo, cta, imagem }, secundarios[] { titulo, sub, imagem }
  - **features_strip**: colunas, items[] { icone, titulo, descricao }
  - **footer**: logo, descricao, redes_sociais[], colunas[], meios_pagamento[], copyright

---

### C) template_id = "portfolio" (French copy: langue "fr")
- **design.palette** + **design.typographie** { display, mono, corps }.
- **profil** (optional): nom, titre, localisation, contacts, etc.
- **sections[]** **type**:
  - **navigation**: logo, liens[] (anchor ids), cta
  - **hero**: label, titre_lignes[] OR titre, sous_titre, boutons[], stats[] { valeur, label }, indicateur_scroll
  - **a_propos**: numero_section, titre, photo, biographie[], infos{}, tags_tech[]
  - **competences_onglets**: numero_section, titre, categories[] { id, label, competences[] { nom, icone, niveau } }
  - **grille_projets**: numero_section, titre, projets[] { numero, nom, description, image, liens, ... }
  - **timeline**: numero_section, titre, experiences[] { periode, poste, entreprise, lieu, description, technologies }
  - **contact**: numero_section, titre, intro, informations[], formulaire { champs[], bouton, toast_succes }
  - **footer**: logo, copyright, reseaux[]

---

## Global rules
- ONE static index page; internal navigation uses **#section-id** matching each section **id** (same page).
- **Colours & fonts**: fill **paleta** / **palette** and **tipografia** / **typographie** from the user's brief (mood, sector, named colours). Do not invent random unrelated palettes.
- **Images**: you MAY use temporary https://images.unsplash.com/... URLs OR leave **imagem** empty; the pipeline replaces them with **Pexels** using **photo_search_query** when present.
  On every object that contains **imagem** / **image** / **photo** / **avatar**, add **photo_search_query** (English, 4–12 words: subject, setting, mood) on the **same object**.
- ALL user-facing copy in **site** must match the language implied by **idioma** / **langue** (Portuguese for hotel/ecommerce, French for portfolio unless the user clearly asks another language).
- **photo_search_query** values are always English (stock API).
- No base64 images. No root-relative internal URLs like "/loja" — use "#id-de-section".
- Return ONLY valid JSON, nothing else."""


def _build_site_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        temperature=0.7,
        top_p=0.9,
        max_output_tokens=16384,
        safety_settings=_gemini_safety_settings(),
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

    try:
        raw = _collect_stream_text(
            client.models.generate_content_stream(
                model=_GEMINI_SITE_STRUCTURE,
                contents=contents,
                config=config,
            ),
            context="site_structure",
        )
    except GeminiGenerationError:
        raise
    except Exception as exc:
        logger.exception("Gemini stream failed (site structure)")
        raise GeminiGenerationError(
            "Erro ao contactar a IA. Tente novamente dentro de alguns minutos.",
            reason="api_error",
        ) from exc

    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    try:
        structure = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned invalid JSON: %s… — %s", raw[:300], exc)
        raise GeminiGenerationError(
            "A IA devolveu um formato inválido. Tente gerar o site novamente.",
            reason="invalid_json",
        ) from exc

    tid = (structure.get("template_id") or "").strip()
    has_triple = tid in ("hotel-reserva", "ecommerce", "portfolio") and isinstance(
        structure.get("site"), dict
    )
    has_legacy = isinstance(structure.get("sections"), list) and len(structure.get("sections") or []) > 0
    has_framework = bool(structure.get("projectInfo")) and bool(structure.get("page"))
    if not has_legacy and not has_framework and not has_triple:
        raise GeminiGenerationError(
            "A IA devolveu uma estrutura incompleta. Tente reformular o briefing.",
            reason="missing_sections",
        )

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
        safety_settings=_gemini_safety_settings(),
        system_instruction=[types.Part.from_text(text=system_text)],
    )

    contents: list[types.Content] = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )

    try:
        text = _collect_stream_text(
            client.models.generate_content_stream(
                model=_GEMINI_TEXT,
                contents=contents,
                config=config,
            ),
            context="chat",
        )
    except GeminiGenerationError:
        raise
    except Exception as exc:
        logger.exception("Gemini stream failed (chat)")
        raise GeminiGenerationError(
            "Erro ao contactar a IA. Verifique a ligação e tente novamente.",
            reason="api_error",
        ) from exc

    return text or "Pode continuar a descrever o site."


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
