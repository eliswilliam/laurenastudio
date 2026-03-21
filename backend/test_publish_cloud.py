"""
E2E text-mode test: login (ou register) → plan dev → /sites/chat → /sites/generate → /api/publish.

Run from host (API sur localhost:8000):
  cd backend && python test_publish_cloud.py

Run dans le conteneur api (Docker):
  docker compose exec api python test_publish_cloud.py

Exiger: backend/.env avec GITHUB_TOKEN, GITHUB_OWNER, GCP_PROJECT_ID, GCP_SA_KEY, et clés Gemini pour generate.

Contourner chat/génération (ex. Gemini indisponible dans Docker) :
  TEST_EXISTING_PROJECT_ID=<uuid>  (dossier uploads/sites/<uuid>/index.html doit exister, projet du même workspace que le compte test)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

API_V1 = os.environ.get("API_V1", "http://localhost:8000/api/v1")
API_ROOT = os.environ.get("API_ROOT", "http://localhost:8000")

# Compte dev (créé si absent)
TEST_EMAIL = os.environ.get("TEST_EMAIL", "test@laurena.co")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "Test123!")


def req(method: str, url: str, data: dict | None = None, token: str | None = None, timeout: int = 300):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"detail": raw}


def register_or_login() -> tuple[str, str, str]:
    s, d = req("POST", f"{API_V1}/auth/login", {"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
    if s == 200:
        return d["tokens"]["access_token"], d["user"]["id"], d["workspace"]["id"]
    print(f"    login failed ({s}), trying register…")
    s, d = req(
        "POST",
        f"{API_V1}/auth/register",
        {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "full_name": "Test Publish",
        },
        timeout=30,
    )
    if s not in (200, 201):
        print("    FAIL register", d)
        sys.exit(1)
    token = d["tokens"]["access_token"]
    user_id = d["user"]["id"]
    ws_id = d["workspace"]["id"]
    return token, user_id, ws_id


def main() -> None:
    print("=== test_publish_cloud.py ===")
    print(f"API_V1={API_V1}")
    print(f"API_ROOT={API_ROOT}")
    print()

    print("[1] Auth")
    token, user_id, ws_id = register_or_login()
    print(f"    user_id={user_id} workspace_id={ws_id}")

    print("[2] Activate plan (dev)")
    s_plans, plans = req("GET", f"{API_V1}/billing/plans", timeout=30)
    plan_name = "starter"
    if s_plans == 200 and isinstance(plans, list) and plans:
        plan_name = str(plans[0].get("name", "starter")).lower()
    s, d = req(
        "POST",
        f"{API_V1}/billing/activate-plan",
        {"workspace_id": ws_id, "plan_name": plan_name},
        token=token,
        timeout=60,
    )
    print(f"    activate_plan status={s} (plan_name={plan_name})")
    if s != 200:
        print("    FAIL", d)
        sys.exit(1)

    skip_gen = os.environ.get("TEST_EXISTING_PROJECT_ID", "").strip()
    if skip_gen:
        project_id = skip_gen
        print(f"[3-4] SKIP sites/chat + generate — TEST_EXISTING_PROJECT_ID={project_id}")
    else:
        print("[3] Sites chat")
        s, d = req(
            "POST",
            f"{API_V1}/sites/chat",
            {
                "project_id": None,
                "messages": [
                    {
                        "role": "user",
                        "content": "Landing muito simples para teste: só hero com título e um parágrafo.",
                    }
                ],
            },
            token=token,
            timeout=120,
        )
        print(f"    status={s}")
        if s != 200:
            print("    FAIL", json.dumps(d, ensure_ascii=False)[:800])
            sys.exit(1)
        project_id = d.get("project_id")
        print(f"    project_id={project_id}")

        print("[4] Sites generate (Gemini)")
        s, d = req(
            "POST",
            f"{API_V1}/sites/generate",
            {"project_id": project_id},
            token=token,
            timeout=300,
        )
        print(f"    status={s}")
        if s != 200:
            print("    FAIL", json.dumps(d, ensure_ascii=False)[:800])
            sys.exit(1)
        print(f"    preview_url={d.get('preview_url')}")

    print("[5] Publish (GitHub → Actions → Cloud Run, pode demorar até ~10 min)")
    print(
        "    >>> La requête HTTP reste ouverte jusqu'à la fin (souvent 15–40 min avec DNS). "
        "Suivez la progression dans un AUTRE terminal :",
        flush=True,
    )
    print("        docker compose logs -f api", flush=True)
    print("    (repérez les lignes [publish] …)", flush=True)
    pub_body: dict = {"userId": user_id, "projectId": project_id, "files": []}
    # Aligner sur le backend (lit .env) : le conteneur n’expose pas toujours CLOUDFLARE_* dans os.environ.
    s_cfg, cfg = req("GET", f"{API_ROOT}/api/publish/config", timeout=30)
    require_slug = bool(s_cfg == 200 and cfg.get("requireSlug"))
    if require_slug or (
        os.environ.get("CLOUDFLARE_ZONE_ID", "").strip()
        and os.environ.get("CLOUDFLARE_TOKEN", "").strip()
        and os.environ.get("ROOT_DOMAIN", "").strip()
    ):
        pub_body["slug"] = os.environ.get("TEST_PUBLISH_SLUG", f"test-{int(time.time())}")
        print(f"    (sous-domaine / DNS) slug={pub_body['slug']}")

    pub_timeout = int(os.environ.get("TEST_PUBLISH_TIMEOUT_SECONDS", "3600"))
    s, d = req(
        "POST",
        f"{API_ROOT}/api/publish",
        pub_body,
        token=token,
        timeout=pub_timeout,
    )
    print(f"    status={s}")
    print(f"    response={json.dumps(d, ensure_ascii=False)}")
    if s != 200:
        sys.exit(1)

    print()
    print("OK — Repo:", d.get("github"))
    print("Actions:", d.get("actionsUrl"))
    print("Site URL:", d.get("siteUrl"))
    print("deployOk:", d.get("deployOk"))

    gh = d.get("github", "")
    if gh.startswith("https://github.com/"):
        path = gh.replace("https://github.com/", "").strip("/").split("/")
        if len(path) >= 2:
            import httpx

            from app.core.config import settings

            h = {
                "Authorization": f"Bearer {settings.GITHUB_TOKEN.strip()}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            pr = httpx.get(
                f"https://api.github.com/repos/{path[0]}/{path[1]}",
                headers=h,
                timeout=30,
            )
            if pr.status_code == 200:
                print("repo private (GitHub API):", pr.json().get("private"))

    if not d.get("siteUrl"):
        print(
            "(Sem URL pública : abra Actions acima ; verifique IAM do GCP — ex. roles/run.admin, cloudbuild.builds.editor, storage.objectAdmin, serviceAccountUser no Cloud Run.)"
        )


if __name__ == "__main__":
    main()
