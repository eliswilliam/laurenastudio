#!/bin/sh
# Wait until api is up before nginx loads config (avoids "host not found in upstream api").
set -eu
max=240
i=0
echo "Waiting for http://api:8000/health (max ${max} iterations, 2s apart)..."
while [ "$i" -lt "$max" ]; do
  if wget -q -T 5 -O- http://api:8000/health >/dev/null 2>&1; then
    echo "api is up, starting nginx"
    exec nginx -g "daemon off;"
  fi
  i=$((i + 1))
  if [ "$i" -gt 0 ] && [ $((i % 30)) -eq 0 ]; then
    echo "  still waiting (${i}/${max})..."
  fi
  sleep 2
done
echo "timeout waiting for api:8000"
exit 1
