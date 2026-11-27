#!/bin/sh
# Combined image (cloud-sql-proxy + nginx + uvicorn + worker): orchestrate startup.
# Production: materialize WIF credentials, start Cloud SQL Auth Proxy, wait, run alembic, exec supervisord.
# Local: skip proxy and WIF (CLOUD_SQL_INSTANCE / WIF_AUDIENCE unset), run alembic against docker-compose db.
# CI: SKIP_ALEMBIC=1 bypasses migrations for smoke tests.
set -eu
cd /app

# Render can connect directly to hosted PostgreSQL providers such as Neon.
# Ignore a legacy Cloud SQL setting when DATABASE_URL is already remote.
if [ "${RENDER:-}" = "true" ]; then
  case "${DATABASE_URL:-}" in
    *"@localhost:"*|*"@127.0.0.1:"*) ;;
    *) unset CLOUD_SQL_INSTANCE ;;
  esac
fi

# Render and other non-Azure hosts inject the service-account payload directly.
# Materialize it before starting Cloud SQL Auth Proxy, which requires an ADC file.
if [ -n "${GOOGLE_CREDENTIALS_JSON:-${GCP_SA_KEY:-}}" ]; then
  mkdir -p /etc/gcp
  python - <<'PY'
import base64
import json
import os
from pathlib import Path

raw = (os.environ.get("GOOGLE_CREDENTIALS_JSON") or os.environ.get("GCP_SA_KEY") or "").strip()
try:
    decoded = base64.b64decode(raw, validate=True).decode("utf-8")
    payload = json.loads(decoded)
except Exception:
    decoded = raw
    payload = json.loads(raw)
if not isinstance(payload, dict):
    raise ValueError("Google credentials must be a JSON object")
path = Path("/etc/gcp/adc.json")
path.write_text(decoded, encoding="utf-8")
path.chmod(0o600)
PY
  export GOOGLE_APPLICATION_CREDENTIALS=/etc/gcp/adc.json
  echo "[entrypoint] Google credentials materialized from environment"
fi

# ── Materialize Google Application Default Credentials from Azure-injected
#    Managed Identity values + the static WIF audience/SA-impersonation URL.
if [ -n "${WIF_AUDIENCE:-}" ] && [ -n "${IDENTITY_ENDPOINT:-}" ] && [ -n "${IDENTITY_HEADER:-}" ]; then
  mkdir -p /etc/gcp
  cat > /etc/gcp/adc.json <<JSON
{
  "type": "external_account",
  "audience": "${WIF_AUDIENCE}",
  "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
  "service_account_impersonation_url": "${WIF_SA_IMPERSONATION_URL}",
  "token_url": "https://sts.googleapis.com/v1/token",
  "credential_source": {
    "url": "${IDENTITY_ENDPOINT}?resource=api%3A%2F%2FAzureADTokenExchange&api-version=2019-08-01",
    "headers": { "X-IDENTITY-HEADER": "${IDENTITY_HEADER}" },
    "format": { "type": "json", "subject_token_field_name": "access_token" }
  }
}
JSON
  export GOOGLE_APPLICATION_CREDENTIALS=/etc/gcp/adc.json
  echo "[entrypoint] WIF credential config written"
fi

# ── Start a bootstrap Cloud SQL Auth Proxy so alembic can connect before supervisord runs.
PROXY_PID=""
if [ -n "${CLOUD_SQL_INSTANCE:-}" ]; then
  echo "[entrypoint] Starting bootstrap Cloud SQL Auth Proxy for $CLOUD_SQL_INSTANCE"
  /usr/local/bin/cloud-sql-proxy \
    --auto-iam-authn \
    --address 127.0.0.1 \
    --port 5432 \
    "$CLOUD_SQL_INSTANCE" &
  PROXY_PID=$!
  i=0
  while [ "$i" -lt 30 ]; do
    if nc -z 127.0.0.1 5432 2>/dev/null; then
      echo "[entrypoint] Proxy ready (PID $PROXY_PID)"
      break
    fi
    i=$((i + 1))
    sleep 1
  done
  if ! nc -z 127.0.0.1 5432 2>/dev/null; then
    echo "[entrypoint] FATAL: proxy did not become ready within 30s"
    kill "$PROXY_PID" 2>/dev/null || true
    exit 1
  fi
fi

# ── Alembic upgrade (retry loop preserves existing behaviour).
if [ "${SKIP_ALEMBIC:-}" != "1" ]; then
  max_attempts=12
  delay=10
  attempt=1
  alembic_ok=0
  while [ "$attempt" -le "$max_attempts" ]; do
    if alembic upgrade head; then
      alembic_ok=1
      break
    fi
    echo "alembic upgrade failed (attempt $attempt/$max_attempts), retrying in ${delay}s..."
    attempt=$((attempt + 1))
    sleep "$delay"
  done
  if [ "$alembic_ok" -ne 1 ]; then
    echo "alembic failed after $max_attempts attempts"
    [ -n "$PROXY_PID" ] && kill "$PROXY_PID" 2>/dev/null || true
    exit 1
  fi
fi

# ── Hand over to supervisord (which spawns its own long-lived proxy via start-cloud-sql-proxy.sh).
if [ -n "$PROXY_PID" ]; then
  echo "[entrypoint] Stopping bootstrap proxy (PID $PROXY_PID) — supervisord will own the long-lived one"
  kill "$PROXY_PID" 2>/dev/null || true
  wait "$PROXY_PID" 2>/dev/null || true
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
