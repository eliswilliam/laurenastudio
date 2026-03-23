#!/bin/sh
# Combined image (nginx + uvicorn + worker): run DB migrations before supervisord.
# App Service injects DATABASE_URL; Postgres is reachable only from the VNet.
# CI / local smoke test: set SKIP_ALEMBIC=1 when no DB is available.
set -eu
cd /app
if [ "${SKIP_ALEMBIC:-}" = "1" ]; then
  exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
fi
max_attempts=12
delay=10
attempt=1
while [ "$attempt" -le "$max_attempts" ]; do
  if alembic upgrade head; then
    exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
  fi
  echo "alembic upgrade failed (attempt $attempt/$max_attempts), retrying in ${delay}s..."
  attempt=$((attempt + 1))
  sleep "$delay"
done
echo "alembic failed after $max_attempts attempts"
exit 1
