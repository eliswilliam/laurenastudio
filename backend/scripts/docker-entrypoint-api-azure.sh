#!/bin/sh
# Azure: retry alembic when Postgres is briefly unavailable during cold start.
set -eu
max_attempts=12
delay=10
attempt=1
while [ "$attempt" -le "$max_attempts" ]; do
  if alembic upgrade head; then
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
  fi
  echo "alembic upgrade failed (attempt $attempt/$max_attempts), retrying in ${delay}s..."
  attempt=$((attempt + 1))
  sleep "$delay"
done
echo "alembic failed after $max_attempts attempts"
exit 1
