"""
Decode Google service account JSON from env vars.

Same rules for:
- GOOGLE_CREDENTIALS_JSON (Azure App Settings — often base64 to avoid mangling)
- GCP_SA_KEY (backend + secrets injected into generated GitHub Actions repos)

Accepts:
- Raw JSON (single line or with newlines, as long as the env layer preserves it)
- Base64-encoded JSON (standard base64; validates before returning decoded bytes as UTF-8)
"""
from __future__ import annotations

import base64
import json


def decode_google_service_account_json(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    try:
        decoded = base64.b64decode(raw, validate=True).decode("utf-8")
        json.loads(decoded)
        return decoded
    except Exception:
        pass
    return raw
