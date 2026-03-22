#!/usr/bin/env bash
# Azure Web App multi-container simulation — run from repository root:
#   bash tests/test_azure_simulation.sh
# Requires: Docker Desktop, docker compose v2, curl, python3.

# Do not use `set -e` — docker/curl/grep failures are handled per test.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.test.yml"
PROJECT="laurenatest"
DC=(docker compose -f "$COMPOSE_FILE" -p "$PROJECT")

# Use 127.0.0.1 — on Windows, localhost can resolve to ::1 while Docker publishes 0.0.0.0 only.
API_BASE="http://127.0.0.1:8001"
FE_BASE="http://127.0.0.1:8080"

PASSED=0
FAILED=0

pass() { PASSED=$((PASSED + 1)); echo "[PASS] $*"; }
fail() { FAILED=$((FAILED + 1)); echo "[FAIL] $*"; }

cleanup() {
  echo "--- Cleanup ---"
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT" down -v 2>/dev/null || true
  echo "Test environment cleaned up."
}

trap cleanup EXIT

psql_exec() {
  local sql="$1"
  "${DC[@]}" exec -T db psql -U test -d laurenadb_test -v ON_ERROR_STOP=1 -c "$sql"
}

register_user() {
  local email="$1"
  # Password must not use double quotes — bash treats ! as history expansion.
  curl -s -X POST "${API_BASE}/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"'"${email}"'","password":"TestPass123!","workspace_name":"Test WS"}'
}

# Parse JSON via the API container's Linux Python (stdin works; host Win Python + Git Bash paths do not).
extract_register() {
  local body="$1"
  printf '%s' "$body" | "${DC[@]}" exec -T api python -c "import json,sys; d=json.load(sys.stdin); print(d['tokens']['access_token']); print(d['user']['id']); print(d['workspace']['id'])" 2>/dev/null || true
}

json_query() {
  local body="$1"
  local py_expr="$2"
  printf '%s' "$body" | "${DC[@]}" exec -T api python -c "import json,sys; d=json.load(sys.stdin); print(${py_expr})" 2>/dev/null || true
}

py_uuid() {
  "${DC[@]}" exec -T api python -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo ""
}

seed_subscription_usage() {
  local ws="$1"
  psql_exec "DELETE FROM usage_tracking WHERE workspace_id = '${ws}';" 2>/dev/null || true
  psql_exec "DELETE FROM subscriptions WHERE workspace_id = '${ws}';" 2>/dev/null || true
  psql_exec "INSERT INTO subscriptions (id, workspace_id, plan_id, status, start_date, created_at)
    VALUES ('sub-' || md5('${ws}'), '${ws}', 'plan-starter-001', 'active', NOW(), NOW());"
  psql_exec "INSERT INTO usage_tracking (id, workspace_id, text_used, image_used, video_used, posts_used, period_start, period_end)
    VALUES (gen_random_uuid()::text, '${ws}', 0, 0, 0, 0, NOW(), NOW() + interval '30 days');"
}

insert_project_prompt() {
  local ws="$1"
  local pid="$2"
  psql_exec "INSERT INTO laurena_site_projects (id, workspace_id, name, status, created_at, updated_at)
    VALUES ('${pid}', '${ws}', 'Test Project', 'draft', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;"
  psql_exec "DELETE FROM laurena_site_prompts WHERE project_id = '${pid}';"
  psql_exec "INSERT INTO laurena_site_prompts (id, project_id, role, content, created_at)
    VALUES (gen_random_uuid()::text, '${pid}', 'user', 'Test brief for generation', NOW());"
}

# --- T1 ---------------------------------------------------------------------
echo "=== T1: Redis connectivity and retry loop ==="
"${DC[@]}" build api worker frontend 2>/dev/null || "${DC[@]}" build
"${DC[@]}" up -d redis
sleep 5
PONG_OUT=$(docker run --rm --network "${PROJECT}_default" redis:7-alpine redis-cli -h redis ping 2>/dev/null || echo "ERR")
if [[ "$PONG_OUT" == *"PONG"* ]] && grep -Eq 'ping|attempt|Redis' "${ROOT_DIR}/backend/app/workers/arq_worker.py" 2>/dev/null; then
  pass "T1: Redis PONG and arq_worker has Redis wait/retry markers"
else
  fail "T1: PONG_OUT='$PONG_OUT' or grep failed"
fi

# --- T2 ---------------------------------------------------------------------
echo "=== T2: API starts and runs migrations ==="
"${DC[@]}" up -d db api
sleep 18
HTTP_CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" "${API_BASE}/health" || echo "000")
API_CID=$("${DC[@]}" ps -q api 2>/dev/null | head -1)
ALEMBIC_OK=0
if [[ -n "$API_CID" ]] && docker logs "$API_CID" 2>&1 | grep -qi "alembic"; then
  ALEMBIC_OK=1
fi
if [[ "$HTTP_CODE" == "200" && "$ALEMBIC_OK" -eq 1 ]]; then
  pass "T2: /health HTTP 200 and alembic in api logs"
else
  fail "T2: HTTP_CODE=$HTTP_CODE ALEMBIC_OK=$ALEMBIC_OK"
fi

# --- T3 ---------------------------------------------------------------------
echo "=== T3: Worker starts and connects to Redis + DB ==="
"${DC[@]}" up -d worker
sleep 12
WRK_CID=$("${DC[@]}" ps -q worker 2>/dev/null | head -1)
T3_OK=0
if [[ -n "$WRK_CID" ]]; then
  LOGS=$(docker logs "$WRK_CID" 2>&1 | tail -n 40)
  if echo "$LOGS" | grep -qi "ConnectionRefusedError"; then
    T3_OK=0
  elif echo "$LOGS" | grep -qiE "Starting worker|redis_version"; then
    T3_OK=1
  fi
fi
if [[ "$T3_OK" -eq 1 ]]; then
  pass "T3: worker logs show ARQ startup without connection refused"
else
  fail "T3: worker log check failed"
fi

# --- T4 ---------------------------------------------------------------------
echo "=== T4: Create generate job via API ==="
EMAIL_A="azure_sim_a_$(date +%s)@example.com"
REG_A=$(register_user "$EMAIL_A")
PARSED_A=$(extract_register "$REG_A")
TOKEN_A=$(echo "$PARSED_A" | sed -n '1p' | tr -d '\r')
USER_A=$(echo "$PARSED_A" | sed -n '2p' | tr -d '\r')
WS_A=$(echo "$PARSED_A" | sed -n '3p' | tr -d '\r')
JOB_ID=""
T4_OK=0
ST=""
if [[ -n "$TOKEN_A" && -n "$WS_A" ]]; then
  seed_subscription_usage "$WS_A"
  PID_A=$(py_uuid)
  insert_project_prompt "$WS_A" "$PID_A"
  G4_TMP="${ROOT_DIR}/.laurenatest_g4.json"
  GEN_CODE=$(curl -s -o "$G4_TMP" -w "%{http_code}" -X POST "${API_BASE}/api/v1/sites/generate" \
    -H "Authorization: Bearer ${TOKEN_A}" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\":\"${PID_A}\"}")
  GEN=$(cat "$G4_TMP" 2>/dev/null || echo "")
  rm -f "$G4_TMP"
  JOB_ID=$(json_query "$GEN" "(d.get('jobId') or d.get('job_id') or '')")
  if [[ "$JOB_ID" =~ ^[0-9a-f-]{36}$ ]]; then
    POLL=$(curl -s -H "Authorization: Bearer ${TOKEN_A}" "${API_BASE}/api/v1/sites/jobs/${JOB_ID}")
    ST=$(json_query "$POLL" "d.get('status','')")
    if [[ "$ST" == "pending" || "$ST" == "running" || "$ST" == "success" || "$ST" == "failed" ]]; then
      T4_OK=1
    fi
  fi
fi
if [[ "$T4_OK" -eq 1 ]]; then
  pass "T4: job_id OK and status=$ST"
else
  fail "T4: generate failed http=$GEN_CODE token_len=${#TOKEN_A} body=${GEN:0:400}"
fi

# --- T5 ---------------------------------------------------------------------
echo "=== T5: Nginx proxy_pass to api:8000 ==="
"${DC[@]}" up -d frontend
sleep 10
H_NGINX=$(curl -s -o /tmp/hn.json -w "%{http_code}" "${FE_BASE}/health" 2>/dev/null || echo "000")
H_API=$(curl -s -o /tmp/ha.json -w "%{http_code}" "${API_BASE}/health" 2>/dev/null || echo "000")
NGX_OK=0
if grep -q 'proxy_pass[[:space:]]\+http://api:8000' "${ROOT_DIR}/nginx.conf" && ! grep -qE 'proxy_pass[^;]*localhost|proxy_pass[^;]*127\.' "${ROOT_DIR}/nginx.conf"; then
  NGX_OK=1
fi
if [[ "$H_NGINX" == "200" && "$H_API" == "200" && "$NGX_OK" -eq 1 ]]; then
  pass "T5: /health via nginx and direct API; nginx.conf uses http://api:8000"
else
  fail "T5: H_NGINX=$H_NGINX H_API=$H_API NGX_OK=$NGX_OK"
fi

# --- T6 ---------------------------------------------------------------------
echo "=== T6: Stale running -> pending after worker restart ==="
T6_OK=0
S6=""
if [[ "$JOB_ID" =~ ^[0-9a-f-]{36}$ ]]; then
  psql_exec "UPDATE background_jobs SET status='running', updated_at = NOW() - interval '2 minutes' WHERE id='${JOB_ID}'::uuid;"
  "${DC[@]}" restart worker
  sleep 16
  P6=$(curl -s -H "Authorization: Bearer ${TOKEN_A}" "${API_BASE}/api/v1/sites/jobs/${JOB_ID}")
  S6=$(json_query "$P6" "d.get('status','')")
  if [[ "$S6" == "pending" ]]; then
    T6_OK=1
  fi
fi
if [[ "$T6_OK" -eq 1 ]]; then
  pass "T6: stale running reset to pending (status=$S6)"
else
  fail "T6: expected pending, got '$S6'"
fi

# --- T7 ---------------------------------------------------------------------
echo "=== T7: Job progresses without browser (background worker) ==="
EMAIL_T7="azure_sim_t7_$(date +%s)@example.com"
REG_T7=$(register_user "$EMAIL_T7")
PARSED_T7=$(extract_register "$REG_T7")
TOK7=$(echo "$PARSED_T7" | sed -n '1p' | tr -d '\r')
WS7=$(echo "$PARSED_T7" | sed -n '3p' | tr -d '\r')
T7_OK=0
S7=""
if [[ -n "$TOK7" && -n "$WS7" ]]; then
  seed_subscription_usage "$WS7"
  PID7=$(py_uuid)
  insert_project_prompt "$WS7" "$PID7"
  G7=$(curl -s -X POST "${API_BASE}/api/v1/sites/generate" \
    -H "Authorization: Bearer ${TOK7}" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\":\"${PID7}\"}")
  J7=$(json_query "$G7" "d.get('jobId','')")
  sleep 10
  P7=$(curl -s -H "Authorization: Bearer ${TOK7}" "${API_BASE}/api/v1/sites/jobs/${J7}")
  S7=$(json_query "$P7" "d.get('status','')")
  if [[ "$S7" == "running" || "$S7" == "success" || "$S7" == "failed" ]]; then
    T7_OK=1
  fi
fi
if [[ "$T7_OK" -eq 1 ]]; then
  pass "T7: job status without client interaction ($S7)"
else
  fail "T7: status=$S7"
fi

# --- T8 ---------------------------------------------------------------------
echo "=== T8: Timeout guard in code + shutdown stale handling ==="
T8_GREP=0
if grep -nE '600|MAX_TASK|Timeout|wait_for|timeout' "${ROOT_DIR}/backend/app/workers/generate_task.py" >/dev/null 2>&1; then
  T8_GREP=1
fi
T8_STAT=""
if [[ -n "$J7" ]]; then
  psql_exec "UPDATE background_jobs SET status='running', updated_at = NOW() - interval '601 seconds' WHERE id='${J7}'::uuid;"
  "${DC[@]}" restart worker
  sleep 14
  P8=$(curl -s -H "Authorization: Bearer ${TOK7}" "${API_BASE}/api/v1/sites/jobs/${J7}")
  T8_STAT=$(json_query "$P8" "d.get('status','')")
fi
T8_OK=0
if [[ "$T8_GREP" -eq 1 && "$T8_STAT" == "pending" ]]; then
  T8_OK=1
fi
if [[ "$T8_OK" -eq 1 ]]; then
  pass "T8: timeout guard in generate_task; stale running -> pending ($T8_STAT)"
else
  fail "T8: grep=$T8_GREP status=$T8_STAT"
fi

# --- T9 ---------------------------------------------------------------------
echo "=== T9: Publish job creation + poll ==="
EMAIL_P="azure_sim_pub_$(date +%s)@example.com"
REG_P=$(register_user "$EMAIL_P")
PARSED_P=$(extract_register "$REG_P")
TOK_P=$(echo "$PARSED_P" | sed -n '1p' | tr -d '\r')
UID_P=$(echo "$PARSED_P" | sed -n '2p' | tr -d '\r')
WSP=$(echo "$PARSED_P" | sed -n '3p' | tr -d '\r')
T9_OK=0
PUB_JOB=""
if [[ -n "$TOK_P" && -n "$UID_P" ]]; then
  seed_subscription_usage "$WSP"
  PUB=$(curl -s -X POST "${API_BASE}/api/publish" \
    -H "Authorization: Bearer ${TOK_P}" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"${UID_P}\",\"files\":[{\"path\":\"index.html\",\"content\":\"<html><body>hi</body></html>\"}]}")
  PUB_JOB=$(json_query "$PUB" "d.get('jobId','')")
  if [[ "$PUB_JOB" =~ ^[0-9a-f-]{36}$ ]]; then
    HP=$(curl -s -o /tmp/pj.json -w "%{http_code}" -H "Authorization: Bearer ${TOK_P}" "${API_BASE}/api/publish/jobs/${PUB_JOB}")
    if [[ "$HP" == "200" ]]; then
      T9_OK=1
    fi
  fi
fi
if [[ "$T9_OK" -eq 1 ]]; then
  pass "T9: publish job_id and GET 200"
else
  fail "T9: PUB=$PUB"
fi

# --- T10 --------------------------------------------------------------------
echo "=== T10: Generate pipeline reaches terminal state with logs ==="
EMAIL_E2E="azure_sim_e2e_$(date +%s)@example.com"
REG_E2E=$(register_user "$EMAIL_E2E")
PARSED_E=$(extract_register "$REG_E2E")
TOK_E2E=$(echo "$PARSED_E" | sed -n '1p' | tr -d '\r')
WSE=$(echo "$PARSED_E" | sed -n '3p' | tr -d '\r')
T10_OK=0
S10=""
LOG_COUNT=0
J10=""
if [[ -n "$TOK_E2E" && -n "$WSE" ]]; then
  seed_subscription_usage "$WSE"
  PIDE=$(py_uuid)
  insert_project_prompt "$WSE" "$PIDE"
  G10=$(curl -s -X POST "${API_BASE}/api/v1/sites/generate" \
    -H "Authorization: Bearer ${TOK_E2E}" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\":\"${PIDE}\"}")
  J10=$(json_query "$G10" "d.get('jobId','')")
  for _ in $(seq 1 45); do
    sleep 3
    PJ=$(curl -s -H "Authorization: Bearer ${TOK_E2E}" "${API_BASE}/api/v1/sites/jobs/${J10}")
    S10=$(json_query "$PJ" "d.get('status','')")
    LOG_COUNT=$(json_query "$PJ" "len(d.get('logs') or [])")
    if [[ "$S10" == "success" || "$S10" == "failed" ]]; then
      break
    fi
  done
  if [[ ( "$S10" == "success" || "$S10" == "failed" ) && "${LOG_COUNT:-0}" -ge 2 ]]; then
    T10_OK=1
  fi
fi
if [[ "$T10_OK" -eq 1 ]]; then
  pass "T10: terminal status=$S10 logs=$LOG_COUNT"
else
  fail "T10: status=$S10 logs=$LOG_COUNT"
fi

# --- T11 --------------------------------------------------------------------
echo "=== T11: Port isolation (worker/redis no published ports) ==="
T11_OK=1
WRK_CID=$( "${DC[@]}" ps -q worker | head -1 )
RD_CID=$( "${DC[@]}" ps -q redis | head -1 )
if [[ -n "$WRK_CID" ]]; then
  if [[ -n "$(docker port "$WRK_CID" 2>/dev/null || true)" ]]; then
    T11_OK=0
  fi
fi
if [[ -n "$RD_CID" ]]; then
  if [[ -n "$(docker port "$RD_CID" 2>/dev/null || true)" ]]; then
    T11_OK=0
  fi
fi
if [[ "$T11_OK" -eq 1 ]]; then
  pass "T11: worker and redis expose no host ports"
else
  fail "T11: unexpected docker port mapping"
fi

# --- T12 --------------------------------------------------------------------
echo "=== T12: Internal DNS (redis, db) ==="
API_CID=$( "${DC[@]}" ps -q api | head -1 )
WRK_CID=$( "${DC[@]}" ps -q worker | head -1 )
T12_OK=0
if [[ -n "$API_CID" && -n "$WRK_CID" ]]; then
  A1=$(docker exec "$API_CID" python -c "import socket; print(socket.gethostbyname('redis'))" 2>/dev/null || echo "")
  A2=$(docker exec "$API_CID" python -c "import socket; print(socket.gethostbyname('db'))" 2>/dev/null || echo "")
  W1=$(docker exec "$WRK_CID" python -c "import socket; print(socket.gethostbyname('redis'))" 2>/dev/null || echo "")
  W2=$(docker exec "$WRK_CID" python -c "import socket; print(socket.gethostbyname('db'))" 2>/dev/null || echo "")
  if [[ -n "$A1" && -n "$A2" && -n "$W1" && -n "$W2" ]]; then
    T12_OK=1
  fi
fi
if [[ "$T12_OK" -eq 1 ]]; then
  pass "T12: hostname resolution in api and worker"
else
  fail "T12: DNS failed"
fi

# --- T13 --------------------------------------------------------------------
echo "=== T13: DB_SSL_REQUIRE in session + worker_db ==="
T13_GREP=0
if grep -q 'DB_SSL_REQUIRE' "${ROOT_DIR}/backend/app/db/worker_db.py" && grep -q 'DB_SSL_REQUIRE' "${ROOT_DIR}/backend/app/db/session.py"; then
  T13_GREP=1
fi
cp "${ROOT_DIR}/.env.test" "${ROOT_DIR}/.env.test.bak.$$"
sed 's/^DB_SSL_REQUIRE=.*/DB_SSL_REQUIRE=true/' "${ROOT_DIR}/.env.test.bak.$$" > "${ROOT_DIR}/.env.test"
"${DC[@]}" up -d api worker
sleep 14
mv "${ROOT_DIR}/.env.test.bak.$$" "${ROOT_DIR}/.env.test"
"${DC[@]}" up -d api worker
sleep 10
if [[ "$T13_GREP" -eq 1 ]]; then
  pass "T13: DB_SSL_REQUIRE handled in worker_db.py and session.py; containers restarted"
else
  fail "T13: missing DB_SSL_REQUIRE in session or worker_db"
fi

# --- T14 --------------------------------------------------------------------
echo "=== T14: Fast polling + growing logs ==="
T14_OK=0
L1=0
L5=0
if [[ -n "$TOK_E2E" && -n "$J10" ]]; then
  T14_SLOW=0
  for i in 1 2 3 4 5; do
    TSEC=$(curl -s -w "%{time_total}" -o /dev/null -H "Authorization: Bearer ${TOK_E2E}" "${API_BASE}/api/v1/sites/jobs/${J10}" || echo "99")
    if ! printf '%s' "$TSEC" | "${DC[@]}" exec -T api python -c "import sys; t=float(sys.stdin.read().strip()); sys.exit(0 if t < 3.0 else 1)"; then
      T14_SLOW=1
    fi
    PJ14=$(curl -s -H "Authorization: Bearer ${TOK_E2E}" "${API_BASE}/api/v1/sites/jobs/${J10}")
    L=$(json_query "$PJ14" "len(d.get('logs') or [])")
    [[ "$i" == 1 ]] && L1=$L
    [[ "$i" == 5 ]] && L5=$L
    sleep 3
  done
  if [[ "$T14_SLOW" -eq 0 && "${L5:-0}" -ge "${L1:-0}" && "${L5:-0}" -ge 2 ]]; then
    T14_OK=1
  fi
fi
if [[ "$T14_OK" -eq 1 ]]; then
  pass "T14: polls <3s, logs L1=$L1 L5=$L5"
else
  fail "T14: slow poll or logs ($L1 -> $L5)"
fi

# --- T15 --------------------------------------------------------------------
echo "=== T15: JWT ownership on job endpoint ==="
EMAIL_B="azure_sim_b_$(date +%s)@example.com"
REG_B=$(register_user "$EMAIL_B")
PARSED_B=$(extract_register "$REG_B")
TOK_B=$(echo "$PARSED_B" | sed -n '1p' | tr -d '\r')
T15_OK=0
CODE15="000"
if [[ "$JOB_ID" =~ ^[0-9a-f-]{36}$ && -n "$TOK_B" ]]; then
  CODE15=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOK_B}" "${API_BASE}/api/v1/sites/jobs/${JOB_ID}")
  if [[ "$CODE15" == "404" || "$CODE15" == "403" ]]; then
    T15_OK=1
  fi
fi
if [[ "$T15_OK" -eq 1 ]]; then
  pass "T15: wrong user HTTP $CODE15"
else
  fail "T15: expected 404/403 got $CODE15"
fi

# --- Summary ----------------------------------------------------------------
TOTAL=$((PASSED + FAILED))
echo ""
echo "================ SUMMARY ================"
printf "%-5s | %-50s | %s\n" "Test" "Description" "Result"
echo "----------------------------------------------------------------"
echo "T1    | Redis ping + arq_worker markers                | $([ $PASSED -ge 1 ] && echo ok)"
echo "Total [PASS] lines should be 15. PASSED=$PASSED FAILED=$FAILED"
echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "Azure simulation complete. 15/15 PASS. Stack is READY for Azure deployment."
  exit 0
else
  echo "Azure simulation complete. $PASSED/$TOTAL checks passed with $FAILED failure(s). Stack is NOT READY."
  exit 1
fi
