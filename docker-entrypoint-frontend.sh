#!/bin/sh
# Start nginx immediately; api will be available via DNS in the Docker network
# No need to block — nginx can handle api failures gracefully with retries
set -eu
echo "Starting nginx..."
exec nginx -g "daemon off;"
