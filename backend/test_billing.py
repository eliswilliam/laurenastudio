"""
Integration test for the subscription & billing system.
Run inside the Docker container.
"""
import httpx
import json
import sys

BASE = "http://localhost:8000/api/v1"

def main():
    print("=" * 60)
    print("LAURENA STUDIO — BILLING SYSTEM INTEGRATION TEST")
    print("=" * 60)

    # 1. List plans (public)
    print("\n=== 1. LIST PLANS (public) ===")
    r = httpx.get(f"{BASE}/billing/plans")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    plans = r.json()
    for p in plans:
        name = p["display_name"]
        price = p["price_brl"]
        tl = p["text_limit"]
        il = p["image_limit"]
        vl = p["video_limit"]
        sl = p["social_limit"]
        pl = p["post_limit"]
        print(f"  {name}: R${price} | text={tl} img={il} vid={vl} social={sl} post={pl}")
    print(f"  -> {len(plans)} plans found. OK")

    # 2. Register test user
    print("\n=== 2. REGISTER USER ===")
    r = httpx.post(f"{BASE}/auth/register", json={
        "email": "billing-test@laurena.studio",
        "password": "TestPass123!",
        "workspace_name": "Billing Test WS",
    })
    assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
    auth = r.json()
    token = auth["tokens"]["access_token"]
    workspace_id = auth["workspace"]["id"]
    print(f"  User: {auth['user']['email']}")
    print(f"  Workspace: {workspace_id}")
    print(f"  Token: {token[:30]}...")

    headers = {"Authorization": f"Bearer {token}"}

    # 3. AI without subscription -> 403
    print("\n=== 3. AI WITHOUT SUBSCRIPTION (expect 403) ===")
    r = httpx.post(f"{BASE}/ai/generate", json={
        "resource_type": "text",
        "prompt": "Write something",
    }, headers=headers)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print(f"  Status: {r.status_code} -> {r.json()['detail']}")
    print("  BLOCKED correctly. OK")

    # 4. Post without subscription -> 403
    print("\n=== 4. POST WITHOUT SUBSCRIPTION (expect 403) ===")
    r = httpx.post(f"{BASE}/posts", json={
        "title": "Test",
        "content": "hello",
    }, headers=headers)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print(f"  Status: {r.status_code} -> {r.json()['detail']}")
    print("  BLOCKED correctly. OK")

    # 5. Social without subscription -> 403
    print("\n=== 5. SOCIAL WITHOUT SUBSCRIPTION (expect 403) ===")
    r = httpx.get(f"{BASE}/social/accounts", headers=headers)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print(f"  Status: {r.status_code} -> BLOCKED. OK")

    # 6. Ads without subscription -> 403
    print("\n=== 6. ADS WITHOUT SUBSCRIPTION (expect 403) ===")
    r = httpx.get(f"{BASE}/ads/campaigns", headers=headers)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print(f"  Status: {r.status_code} -> BLOCKED. OK")

    # 7. Analytics without subscription -> 403
    print("\n=== 7. ANALYTICS WITHOUT SUBSCRIPTION (expect 403) ===")
    r = httpx.get(f"{BASE}/analytics/overview", headers=headers)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print(f"  Status: {r.status_code} -> BLOCKED. OK")

    # 8. Activate Starter plan
    print("\n=== 8. ACTIVATE STARTER PLAN ===")
    r = httpx.post(f"{BASE}/billing/activate-plan", json={
        "workspace_id": workspace_id,
        "plan_name": "starter",
    }, headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    act = r.json()
    print(f"  Message: {act['message']}")
    print(f"  Sub status: {act['subscription']['status']}")
    assert act["subscription"]["status"] == "active"
    print("  Activated. OK")

    # 9. AI with subscription -> 200
    print("\n=== 9. AI GENERATE WITH SUBSCRIPTION ===")
    r = httpx.post(f"{BASE}/ai/generate", json={
        "resource_type": "text",
        "prompt": "Write a post about travel",
    }, headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    gen = r.json()
    print(f"  Usage after: {gen['usage_after']}/{gen['limit']}")
    print("  Generated. OK")

    # 10. Create a post -> 200
    print("\n=== 10. CREATE POST ===")
    r = httpx.post(f"{BASE}/posts", json={
        "title": "My first post",
        "content": "Hello world!",
    }, headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    post = r.json()
    print(f"  Post usage: {post['usage_after']}/{post['limit']}")
    print("  Created. OK")

    # 11. Social with subscription -> 200
    print("\n=== 11. SOCIAL WITH SUBSCRIPTION ===")
    r = httpx.get(f"{BASE}/social/accounts", headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    print("  Accessible. OK")

    # 12. Billing status
    print("\n=== 12. BILLING STATUS ===")
    r = httpx.get(f"{BASE}/billing/status", headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    bs = r.json()
    print(f"  Active: {bs['is_active']}")
    if bs["usage"]:
        u = bs["usage"]
        print(f"  Text: {u['usage']['text_used']} used, {u['text_remaining']} remaining")
        print(f"  Posts: {u['usage']['posts_used']} used, {u['posts_remaining']} remaining")
    print("  OK")

    # 13. Usage endpoint
    print("\n=== 13. USAGE ENDPOINT ===")
    r = httpx.get(f"{BASE}/billing/usage", headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    u = r.json()
    print(f"  Text: {u['text_remaining']}/{u['limits']['text_limit']}")
    print(f"  Image: {u['image_remaining']}/{u['limits']['image_limit']}")
    print("  OK")

    # 14. Cancel subscription
    print("\n=== 14. CANCEL SUBSCRIPTION ===")
    r = httpx.post(f"{BASE}/billing/cancel", json={
        "workspace_id": workspace_id,
    }, headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    cancel = r.json()
    print(f"  Message: {cancel['message']}")
    print(f"  Status: {cancel['subscription']['status']}")
    assert cancel["subscription"]["status"] == "canceled"
    print("  Canceled. OK")

    # 15. AI after cancel -> 403
    print("\n=== 15. AI AFTER CANCEL (expect 403) ===")
    r = httpx.post(f"{BASE}/ai/generate", json={
        "resource_type": "text",
        "prompt": "try again",
    }, headers=headers)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print(f"  Status: {r.status_code} -> BLOCKED. OK")

    # 16. Re-activate with Pro plan
    print("\n=== 16. ACTIVATE PRO PLAN ===")
    r = httpx.post(f"{BASE}/billing/activate-plan", json={
        "workspace_id": workspace_id,
        "plan_name": "pro",
    }, headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    act2 = r.json()
    print(f"  Message: {act2['message']}")
    print("  OK")

    # 17. Usage shows Pro limits
    print("\n=== 17. VERIFY PRO LIMITS ===")
    r = httpx.get(f"{BASE}/billing/usage", headers=headers)
    assert r.status_code == 200
    u2 = r.json()
    print(f"  Text remaining: {u2['text_remaining']} (limit: {u2['limits']['text_limit']})")
    print(f"  Image remaining: {u2['image_remaining']} (limit: {u2['limits']['image_limit']})")
    print(f"  Video remaining: {u2['video_remaining']} (limit: {u2['limits']['video_limit']})")
    assert u2["limits"]["text_limit"] == 300
    assert u2["limits"]["image_limit"] == 100
    print("  Pro limits verified. OK")

    # 18. Change plan to Business
    print("\n=== 18. CHANGE TO BUSINESS PLAN ===")
    r = httpx.post(f"{BASE}/billing/change-plan", json={
        "workspace_id": workspace_id,
        "plan_name": "business",
    }, headers=headers)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    chg = r.json()
    print(f"  Message: {chg['message']}")
    print("  OK")

    # 19. Verify Business unlimited
    print("\n=== 19. VERIFY BUSINESS UNLIMITED ===")
    r = httpx.get(f"{BASE}/billing/usage", headers=headers)
    assert r.status_code == 200
    u3 = r.json()
    print(f"  Post limit: {u3['limits']['post_limit']} (0=unlimited)")
    print(f"  Social limit: {u3['limits']['social_limit']} (0=unlimited)")
    print(f"  Text remaining: {u3['text_remaining']} (-1=unlimited)")
    assert u3["limits"]["post_limit"] == 0   # unlimited
    assert u3["limits"]["social_limit"] == 0  # unlimited
    print("  Business unlimited verified. OK")

    # 20. All endpoints listed
    print("\n=== 20. ALL API ENDPOINTS ===")
    r = httpx.get("http://localhost:8000/openapi.json")
    schema = r.json()
    for path in sorted(schema["paths"]):
        methods = list(schema["paths"][path].keys())
        print(f"  {path} {methods}")

    print("\n" + "=" * 60)
    print("ALL 20 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
