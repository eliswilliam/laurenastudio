"""
Push generated site files to a new GitHub repository in a single commit (Git Data API),
inject GitHub Actions secrets with LibSodium (sealed box), no local git.
"""
from __future__ import annotations

import base64
import logging
import re
import time
import httpx
from github import Github, GithubException
from github.InputGitTreeElement import InputGitTreeElement
from nacl import public

from app.core.config import settings
from app.core.google_credentials import decode_google_service_account_json

logger = logging.getLogger(__name__)

DOCKERFILE_CONTENT = """FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 8080
# Cloud Run → port 8080; nginx:alpine uses conf.d and/or http.d.
CMD sh -c 'sed -i "s/listen[[:space:]]*80/listen 8080/g" /etc/nginx/conf.d/default.conf 2>/dev/null; sed -i "s/listen[[:space:]]*80/listen 8080/g" /etc/nginx/http.d/default.conf 2>/dev/null; exec nginx -g "daemon off;"'
"""

DOCKERIGNORE_CONTENT = """.github
"""

SECRET_GCP_SA = "GCP_SA_KEY"
SECRET_GCP_PROJECT = "GCP_PROJECT_ID"


class GitHubPublishError(Exception):
    """User-facing publish pipeline error."""

    def __init__(self, message: str, step: str | None = None):
        self.step = step
        super().__init__(message)


def _gh_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.GITHUB_TOKEN.strip()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def decode_gcp_sa_key(raw: str) -> str:
    """Same decoding as GOOGLE_CREDENTIALS_JSON (see app.core.google_credentials)."""
    return decode_google_service_account_json(raw)


def _encrypt_actions_secret(public_key_b64: str, secret_value: str) -> str:
    key_bytes = base64.b64decode(public_key_b64)
    pk = public.PublicKey(key_bytes)
    box = public.SealedBox(pk)
    encrypted = box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def _put_repo_secret(owner: str, repo: str, secret_name: str, secret_value: str) -> None:
    url_base = "https://api.github.com"
    pk_url = f"{url_base}/repos/{owner}/{repo}/actions/secrets/public-key"
    put_url = f"{url_base}/repos/{owner}/{repo}/actions/secrets/{secret_name}"
    try:
        with httpx.Client(timeout=60.0) as client:
            r = client.get(pk_url, headers=_gh_headers())
            if r.status_code != 200:
                raise GitHubPublishError(
                    f"Could not read Actions public key ({r.status_code}): {r.text[:500]}",
                    step="secrets_public_key",
                )
            data = r.json()
            key_id = data["key_id"]
            enc = _encrypt_actions_secret(data["key"], secret_value)
            put = client.put(
                put_url,
                headers=_gh_headers(),
                json={"encrypted_value": enc, "key_id": key_id},
            )
            if put.status_code not in (201, 204):
                raise GitHubPublishError(
                    f"Failed to set secret {secret_name} ({put.status_code}): {put.text[:500]}",
                    step=f"secret_{secret_name}",
                )
    except GitHubPublishError:
        raise
    except Exception as exc:
        raise GitHubPublishError(f"Secrets API error: {exc}", step="secrets") from exc


def _deploy_workflow_yaml(region: str) -> str:
    # Literal ${{ … }} must not be an f-string (GitHub Actions expression syntax).
    return (
        """name: Deploy static site to Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.repository }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      # Les APIs (Run, Cloud Build, Artifact Registry) doivent être activées une fois
      # par un compte avec droits Service Usage (Owner / Editor), pas par github-deployer.

      - name: Deploy to Cloud Run
        env:
          CLOUDSDK_CORE_DISABLE_PROMPTS: "1"
        run: |
          set -e
          gcloud run deploy "${{ github.event.repository.name }}" \\
            --project "${{ secrets.GCP_PROJECT_ID }}" \\
            --source . \\
            --region "REGION_PLACEHOLDER" \\
            --allow-unauthenticated \\
            --quiet
"""
    ).replace("REGION_PLACEHOLDER", region)


def _validate_settings() -> None:
    if not settings.GITHUB_TOKEN.strip():
        raise GitHubPublishError("GITHUB_TOKEN is not configured.", step="config")
    if not settings.GITHUB_OWNER.strip():
        raise GitHubPublishError("GITHUB_OWNER is not configured.", step="config")
    if not settings.GCP_PROJECT_ID.strip():
        raise GitHubPublishError("GCP_PROJECT_ID is not configured.", step="config")
    raw_sa = decode_gcp_sa_key(settings.GCP_SA_KEY)
    if not raw_sa.strip() or not raw_sa.strip().startswith("{"):
        raise GitHubPublishError(
            "GCP_SA_KEY is missing or not valid JSON (use raw JSON or base64 of JSON).",
            step="config",
        )


def _repo_slug(user_id: str) -> str:
    uid = re.sub(r"[^a-zA-Z0-9-]", "-", user_id.strip())
    uid = re.sub(r"-+", "-", uid).strip("-") or "user"
    ts = int(time.time())
    name = f"site-{uid}-{ts}"
    if len(name) > 100:
        name = name[:100].rstrip("-")
    return name


def _create_repository(g: Github, owner: str, name: str):
    try:
        authed = g.get_user()
        if authed.login.lower() == owner.lower():
            return authed.create_repo(name, private=True, auto_init=True)
        org = g.get_organization(owner)
        return org.create_repo(name, private=True, auto_init=True)
    except GithubException as exc:
        raise GitHubPublishError(
            f"GitHub rejected repository creation: {exc.data.get('message', exc)}",
            step="create_repo",
        ) from exc


def publish_site_files(file_map: list[tuple[str, str]], user_id: str) -> tuple[str, str, str]:
    """
    file_map: list of (posix path, utf-8 content).
    Returns (https://github.com/owner/repo, repo_name, commit_sha) for Cloud Run + DB.
    """
    _validate_settings()
    owner = settings.GITHUB_OWNER.strip()
    region = (settings.GCP_REGION or "us-central1").strip()
    sa_plain = decode_gcp_sa_key(settings.GCP_SA_KEY)
    project_id = settings.GCP_PROJECT_ID.strip()

    g = Github(settings.GITHUB_TOKEN.strip())
    repo_name = _repo_slug(user_id)

    # STEP 1 — create repo (README + initial commit on main)
    try:
        repo = _create_repository(g, owner, repo_name)
    except GitHubPublishError:
        raise

    # GitHub eventual consistency + default branch init
    time.sleep(2)

    # STEP 4 (early): inject Actions secrets *before* the commit that adds
    # deploy.yml — otherwise the first workflow run may start without secrets.
    try:
        _put_repo_secret(owner, repo_name, SECRET_GCP_SA, sa_plain)
        _put_repo_secret(owner, repo_name, SECRET_GCP_PROJECT, project_id)
    except GitHubPublishError:
        raise

    try:
        main_ref = repo.get_git_ref("heads/main")
    except GithubException as exc:
        raise GitHubPublishError(
            f"Could not read ref heads/main after create: {exc}",
            step="read_main",
        ) from exc

    base_commit = repo.get_git_commit(main_ref.object.sha)

    extra = [
        ("Dockerfile", DOCKERFILE_CONTENT),
        (".dockerignore", DOCKERIGNORE_CONTENT),
        (".github/workflows/deploy.yml", _deploy_workflow_yaml(region)),
    ]
    paths_seen: set[str] = set()
    elements: list[InputGitTreeElement] = []

    for rel, content in file_map + extra:
        norm = rel.replace("\\", "/").lstrip("/")
        if not norm or norm in paths_seen:
            continue
        paths_seen.add(norm)
        elements.append(
            InputGitTreeElement(path=norm, mode="100644", type="blob", content=content)
        )

    if not elements:
        raise GitHubPublishError("No files to commit.", step="tree")

    # STEP 3 — single commit with full tree (triggers Actions → Cloud Run)
    try:
        new_tree = repo.create_git_tree(elements, base_commit.tree)
        new_commit = repo.create_git_commit(
            "🚀 Site généré par IA",
            new_tree,
            [base_commit],
        )
        main_ref.edit(new_commit.sha)
    except GithubException as exc:
        raise GitHubPublishError(
            f"Git commit/tree update failed: {exc.data.get('message', exc)}",
            step="git_commit",
        ) from exc

    return f"https://github.com/{owner}/{repo_name}", repo_name, new_commit.sha
