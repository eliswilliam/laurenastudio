#!/bin/sh
# Supervisord-managed wrapper for cloud-sql-proxy.
# Production (CLOUD_SQL_INSTANCE set): exec the proxy.
# Local dev (env var unset): no-op so supervisord doesn't restart-loop.
set -eu

if [ -z "${CLOUD_SQL_INSTANCE:-}" ]; then
  echo "[cloud-sql-proxy] CLOUD_SQL_INSTANCE not set; proxy disabled."
  exec sleep infinity
fi

exec /usr/local/bin/cloud-sql-proxy \
  --auto-iam-authn \
  --address 127.0.0.1 \
  --port 5432 \
  "$CLOUD_SQL_INSTANCE"
