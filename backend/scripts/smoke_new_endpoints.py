"""Smoke tests locaux (sans réseau) pour Groq site_ai + vérif routes."""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import httpx
from openai import APIStatusError

from app.main import app
from app.services import site_ai_service as sia


class FakeResponsesOutput:
    """Réponse minimale pour client.responses.create (output_text)."""

    def __init__(self, text: str) -> None:
        self.output_text = text


def _api_status_404() -> APIStatusError:
    req = httpx.Request("POST", "https://api.groq.com/openai/v1/responses")
    resp = httpx.Response(404, request=req)
    return APIStatusError("not found", response=resp, body=None)


def test_routes_registered() -> None:
    paths = {getattr(r, "path", None) for r in app.routes}
    need = {
        "/api/v1/indexing/overview",
        "/api/v1/indexing/request",
        "/api/v1/sites/chat",
        "/api/v1/marketing/generate-image",
    }
    missing = need - paths
    assert not missing, f"Routes manquantes: {missing}"


def test_groq_site_structure_mock_responses() -> None:
    site_json = {
        "template_id": "hotel-reserva",
        "site": {"id": "demo", "nome": "Test", "tipo": "hotel", "idioma": "pt-BR", "secoes": []},
    }
    raw = json.dumps(site_json)
    fake_client = MagicMock()
    fake_client.responses.create.return_value = FakeResponsesOutput(raw)

    with patch.object(sia, "_groq_client", return_value=fake_client):
        out = sia._sync_generate_site_structure("brief")
    assert out["template_id"] == "hotel-reserva"
    fake_client.responses.create.assert_called_once()
    fake_client.chat.completions.create.assert_not_called()


def test_groq_chat_mock_responses() -> None:
    fake_client = MagicMock()
    fake_client.responses.create.return_value = FakeResponsesOutput(
        "Olá! Quando quiser, clique em « Gerar site » para ver o preview."
    )
    with patch.object(sia, "_groq_client", return_value=fake_client):
        r = sia._sync_chat_reply([{"role": "user", "content": "Oi"}], "Oi")
    assert "Gerar site" in r
    fake_client.responses.create.assert_called_once()
    fake_client.chat.completions.create.assert_not_called()


def test_groq_fallback_chat_when_responses_404() -> None:
    class FakeMsg:
        def __init__(self, c: str) -> None:
            self.content = c

    class FakeChoice:
        def __init__(self, c: str) -> None:
            self.message = FakeMsg(c)

    class FakeChatResp:
        def __init__(self, c: str) -> None:
            self.choices = [FakeChoice(c)]

    site_json = {
        "template_id": "hotel-reserva",
        "site": {"id": "demo", "nome": "Test", "tipo": "hotel", "idioma": "pt-BR", "secoes": []},
    }
    raw = json.dumps(site_json)
    fake_client = MagicMock()
    fake_client.responses.create.side_effect = _api_status_404()
    fake_client.chat.completions.create.return_value = FakeChatResp(raw)

    with patch.object(sia, "_groq_client", return_value=fake_client):
        out = sia._sync_generate_site_structure("brief")
    assert out["template_id"] == "hotel-reserva"
    assert fake_client.responses.create.call_count == 1
    fake_client.chat.completions.create.assert_called_once()


if __name__ == "__main__":
    test_routes_registered()
    print("routes: OK")
    test_groq_site_structure_mock_responses()
    print("groq site_structure (responses mock): OK")
    test_groq_chat_mock_responses()
    print("groq chat (responses mock): OK")
    test_groq_fallback_chat_when_responses_404()
    print("groq fallback chat.completions (404): OK")
