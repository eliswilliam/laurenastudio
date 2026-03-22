#!/bin/sh
# Azure multi-container: nginx resolves "api" at config load. If the frontend
# container starts before DNS/api is ready, nginx exits with [emerg] host not
# found in upstream "api". Wait until the API answers before starting nginx.
set -eu
# Alembic + cold DB on Azure can exceed 3 minutes; allow ~8 minutes by default.
MAX_ATTEMPTS="${WAIT_FOR_API_MAX_ATTEMPTS:-240}"
INTERVAL="${WAIT_FOR_API_INTERVAL_SEC:-2}"
echo "Waiting for http://api:8000/health (max ${MAX_ATTEMPTS} attempts, ${INTERVAL}s apart)..."
i=1
while [ "$i" -le "$MAX_ATTEMPTS" ]; do
  if wget -q -O- --timeout=5 "http://api:8000/health" >/dev/null 2>&1; then
    echo "api is reachable, starting nginx"
    exec nginx -g "daemon off;"
  fi
  if [ $((i % 15)) -eq 0 ]; then
    echo "  still waiting... ($i/${MAX_ATTEMPTS})"
  fi
  i=$((i + 1))
  sleep "$INTERVAL"
done
echo "ERROR: timed out waiting for api:8000 — nginx would fail on upstream 'api'"
exit 1
