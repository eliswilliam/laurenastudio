"""
Tests for Pexels stock photo integration.
- Unit tests run without network / without API key.
- Live test uses PEXELS_API_KEY from .env (loaded by app.core.config) when pytest cwd is backend/.
"""
from unittest.mock import patch

import pytest

from app.core.config import settings
from app.services import pexels_service as ps


def test_section_to_search_query_uses_heading_and_site():
    q = ps._section_to_search_query(
        {"type": "hero", "heading": "Bem-vindo", "subheading": "Café artesanal"},
        "Café Aurora",
        "brief text here",
    )
    assert "Café Aurora" in q or "Bem" in q or "Caf" in q
    assert len(q) > 0


def test_enrich_all_non_footer_sections_get_image_fields():
    structure = {
        "site_name": "Test Shop",
        "sections": [
            {"type": "hero", "heading": "Home"},
            {"type": "about", "heading": "About us"},
            {"type": "footer", "heading": "© 2025"},
        ],
    }

    def fake_search(query: str):
        return {
            "url": "https://images.pexels.com/photos/1/test.jpeg",
            "photographer": "Jane",
            "photographer_url": "https://www.pexels.com/@jane",
            "pexels_url": "https://www.pexels.com/photo/1/",
        }

    with patch.object(ps, "_search_pexels_first_photo_sync", side_effect=fake_search):
        out = ps._sync_enrich_structure(structure, "brief")

    secs = out["sections"]
    assert secs[0]["stock_image_url"].startswith("https://")
    assert secs[0]["stock_image_source"] == "pexels"
    assert secs[1]["stock_image_source"] == "pexels"
    assert secs[2].get("stock_image_url") is None  # footer skipped


def test_footer_skipped_no_stock_url():
    structure = {
        "site_name": "X",
        "sections": [{"type": "footer", "heading": "Foot"}],
    }
    with patch.object(ps, "_search_pexels_first_photo_sync", return_value=None):
        out = ps._sync_enrich_structure(structure, "")
    assert out["sections"][0].get("stock_image_url") is None


@pytest.mark.skipif(
    not (settings.PEXELS_API_KEY or "").strip(),
    reason="PEXELS_API_KEY not set in backend/.env",
)
def test_pexels_live_api_returns_photo():
    """Hits api.pexels.com with your key; fails if key invalid or API down."""
    assert (settings.PEXELS_API_KEY or "").strip(), "PEXELS_API_KEY must be non-empty"
    result = ps.pexels_api_smoke_check()
    assert result["ok"], result
    assert result.get("sample_url", "").startswith("https://")
