"""Tests unitaires pour le mapping nom Google → Cloudflare (sans API)."""
from app.services.dns_service import _cloudflare_name_from_google_record


def test_strips_root_to_slug_label():
    assert (
        _cloudflare_name_from_google_record(
            "demo.laurenastudio.pro",
            root="laurenastudio.pro",
            slug="demo",
            fqdn="demo.laurenastudio.pro",
        )
        == "demo"
    )


def test_acme_challenge_relative_name():
    assert (
        _cloudflare_name_from_google_record(
            "_acme-challenge.demo.laurenastudio.pro",
            root="laurenastudio.pro",
            slug="demo",
            fqdn="demo.laurenastudio.pro",
        )
        == "_acme-challenge.demo"
    )


def test_fqdn_equals_slug_dot_root_returns_slug():
    assert (
        _cloudflare_name_from_google_record(
            "demo.laurenastudio.pro",
            root="laurenastudio.pro",
            slug="demo",
            fqdn="demo.laurenastudio.pro",
        )
        == "demo"
    )


def test_partial_name_without_zone_suffix_passthrough():
    assert (
        _cloudflare_name_from_google_record(
            "_acme-challenge.demo",
            root="laurenastudio.pro",
            slug="demo",
            fqdn="demo.laurenastudio.pro",
        )
        == "_acme-challenge.demo"
    )
