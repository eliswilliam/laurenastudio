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
import os
import tempfile
from pathlib import Path

_TEMP_GCP_CREDENTIALS_PATH: Path | None = None


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


def _is_supported_adc_file(path: Path) -> bool:
    """Check whether a credentials file looks like a supported Google ADC JSON."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False

    if not isinstance(payload, dict):
        return False

    # Accept service account keys and user ADC refresh-token files.
    if payload.get("type") == "service_account":
        return True
    if payload.get("client_id") and payload.get("refresh_token"):
        return True
    return False


def _iter_adc_candidate_paths() -> list[Path]:
    """Return common ADC file candidates across local Windows/Linux and containers."""
    candidates: list[Path] = []

    configured = (os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
    if configured:
        candidates.append(Path(configured).expanduser())

    appdata = (os.getenv("APPDATA") or "").strip()
    if appdata:
        candidates.append(Path(appdata) / "gcloud" / "application_default_credentials.json")

    userprofile = (os.getenv("USERPROFILE") or "").strip()
    if userprofile:
        candidates.append(Path(userprofile) / ".config" / "gcloud" / "application_default_credentials.json")

    candidates.append(Path.home() / ".config" / "gcloud" / "application_default_credentials.json")
    candidates.append(Path("/root/.config/gcloud/application_default_credentials.json"))

    unique: list[Path] = []
    seen: set[str] = set()
    for path in candidates:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique


def ensure_google_application_credentials(raw_json: str) -> str:
    """Ensure GOOGLE_APPLICATION_CREDENTIALS points to a valid ADC JSON file.

    Priority order:
    1. GOOGLE_CREDENTIALS_JSON (explicit SA for Vertex AI) — highest priority so that
       a local gcloud ADC file from a different account never shadows it.
    2. Cached temp file from a previous call (same JSON already written to disk).
    3. ADC files on disk (gcloud application-default login) — only when no explicit JSON.
    """
    global _TEMP_GCP_CREDENTIALS_PATH

    # Priority 1 — explicit JSON beats local gcloud ADC
    decoded = decode_google_service_account_json(raw_json)
    if decoded:
        if _TEMP_GCP_CREDENTIALS_PATH and _TEMP_GCP_CREDENTIALS_PATH.is_file():
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_TEMP_GCP_CREDENTIALS_PATH)
            return str(_TEMP_GCP_CREDENTIALS_PATH)

        fd, temp_path = tempfile.mkstemp(prefix="laurena-gcp-sa-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(decoded)
        _TEMP_GCP_CREDENTIALS_PATH = Path(temp_path)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_TEMP_GCP_CREDENTIALS_PATH)
        return str(_TEMP_GCP_CREDENTIALS_PATH)

    # Priority 2 — cached temp file (raw_json was empty but we already wrote it before)
    if _TEMP_GCP_CREDENTIALS_PATH and _TEMP_GCP_CREDENTIALS_PATH.is_file():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_TEMP_GCP_CREDENTIALS_PATH)
        return str(_TEMP_GCP_CREDENTIALS_PATH)

    # Priority 3 — local gcloud ADC (fallback for pure local dev without GOOGLE_CREDENTIALS_JSON)
    for candidate in _iter_adc_candidate_paths():
        if candidate.is_file() and _is_supported_adc_file(candidate):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(candidate)
            return str(candidate)

    return ""
