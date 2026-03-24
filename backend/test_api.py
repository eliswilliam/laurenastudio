"""
Quick API test script - runs inside container.
"""
import urllib.request
import urllib.error
import json

BASE = "http://localhost:8000/api/v1"


def req(method, path, data=None, token=None, ws_header=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if ws_header:
        headers["X-Workspace-ID"] = ws_header
    body = json.dumps(data).encode() if data else None
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
        )
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body) if body else {"error": "empty response"}
        except json.JSONDecodeError:
            return e.code, {"error": body or "empty response"}


def test_all():
    print("=" * 60)
    print("API TEST SUITE")
    print("=" * 60)

    # --- Auth ---
    s, d = req("POST", "/auth/login", {"email": "test@laurena.co", "password": "Test123!"})
    print(f"[AUTH] Login: {s}")
    if s != 200:
        print("  ERROR:", d)
        return
    token = d["tokens"]["access_token"]
    ws_id = d["tenant_id"]
    print(f"  tenant_id={ws_id}")

    # --- Plans ---
    s, d = req("GET", "/billing/plans")
    print(f"[BILLING] Plans: {s}")
    if isinstance(d, list):
        for p in d:
            print(f"  - {p.get('name')} / slug={p.get('slug')}")
        plan_slug = d[0].get("name") if d else "starter"
    else:
        print("  ERROR:", d)
        plan_slug = "starter"

    # --- Activate plan (dev endpoint) ---
    s, d = req("POST", "/billing/activate-plan", {"workspace_id": ws_id, "plan_name": plan_slug}, token=token)
    print(f"[BILLING] Activate Plan '{plan_slug}': {s}")
    print(f"  {str(d)[:200]}")

    # --- Billing status ---
    s, d = req("GET", "/billing/status", token=token, ws_header=ws_id)
    print(f"[BILLING] Status: {s}")
    print(f"  {str(d)[:200]}")

    # --- Posts (create) ---
    s, d = req(
        "POST",
        "/posts",
        {"title": "Test Post", "content": "Hello world", "platform": "instagram", "workspace_id": ws_id},
        token=token,
        ws_header=ws_id,
    )
    print(f"[POSTS] Create: {s}")
    print(f"  {str(d)[:200]}")

    # --- AI Generate ---
    s, d = req(
        "POST",
        "/ai/generate",
        {
            "workspace_id": ws_id,
            "resource_type": "text",
            "prompt": "Short Instagram caption about coffee",
            "style": "casual",
            "model": "gemini",
        },
        token=token,
        ws_header=ws_id,
    )
    print(f"[AI] Generate caption: {s}")
    if s == 200:
        print(f"  content={str(d.get('content', ''))[:150]}")
    else:
        print(f"  {str(d)[:200]}")

    # --- Media list ---
    s, d = req("GET", f"/media/?workspace_id={ws_id}", token=token, ws_header=ws_id)
    print(f"[MEDIA] List: {s}")
    print(f"  {str(d)[:200]}")

    # --- Criar site / Laurena chat (needs Gemini; may fail without API key) ---
    s, d = req(
        "POST",
        "/sites/chat",
        {
            "project_id": None,
            "messages": [
                {"role": "user", "content": "Quero uma landing para uma pastelaria em Lisboa."}
            ],
        },
        token=token,
    )
    print(f"[SITES] Chat: {s}")
    if s == 200:
        print(f"  project_id={d.get('project_id')} reply={str(d.get('reply', ''))[:120]}…")
    else:
        print(f"  {str(d)[:300]}")

    print("=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    test_all()
