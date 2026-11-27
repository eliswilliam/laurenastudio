# Audit: "Criar site" → Custom URL Publish Flow

Traceability document (state after fixes). Legend: OK / ⚠️ / ❌.

## Environment Variables (no hardcoded keys in application code)

| Variable | Usage |
|----------|--------|
| `GITHUB_TOKEN` | `app.core.config.settings` → `github_publish_service` |
| `GITHUB_OWNER` | same |
| `GCP_PROJECT_ID` | GitHub Actions secrets + `cloud_run_lookup` |
| `GCP_SA_KEY` | GitHub Actions secrets (JSON/base64) |
| `CLOUDFLARE_TOKEN` | `dns_service._headers()` |
| `CLOUDFLARE_ZONE_ID` | Cloudflare DNS API |
| `ROOT_DOMAIN` | CNAME + final URL `https://{slug}.{ROOT_DOMAIN}` |
| `GOOGLE_INDEXING_ENABLED` | Enables `POST /api/v1/indexing/request` + overview (`google_indexing_service`) |
| `GOOGLE_INDEXING_DEFER_SECONDS` | Delay after **Publicar** before **Indexar** allows clicking (default 5400 s) |
| `DATABASE_URL` | `Settings` → async SQLAlchemy |

`GCP_REGION` and `CLOUD_RUN_POLL_*` configure Cloud Run polling. Local default values (e.g., `DATABASE_URL`) exist for local development only.

---

## Step 1 — Frontend (prompt + slug)

| Item | Status | Detail |
|------|--------|--------|
| User prompt | OK | `Textarea` `rascunho` → `POST /api/v1/sites/chat` |
| Slug field | OK | `Input` `publishSlug`, filters lowercase letters/numbers/hyphens |
| Slug validation | OK | `slugValid()`; if backend requires slug (`GET /api/publish/config`), blocks when empty |
| Publish button while loading | OK | `disabled={aPublicar \|\| !usuario?.id}` |

## Step 2 — Publish Call (frontend → backend)

| Item | Status | Detail |
|------|--------|--------|
| POST `/api/publish` | OK | `publishApi.ts`, Vite proxy `/api` → FastAPI |
| Body | ⚠️ | `{ userId, projectId, files, slug? }` — **no** `prompt` in publish body: the brief is stored in the DB (`user_prompt`) after `/sites/generate` |
| Content-Type | OK | `application/json` |
| Loading / error states | OK | `aPublicar`, `formatApiError`, chat message + banner |
| Final URL | OK | `siteUrl` + `success` / `deployOk` |

## Step 3 — FastAPI Endpoint

| Item | Status | Detail |
|------|--------|--------|
| Router | OK | `main.py`: `include_router(publish_router, prefix="/api")` |
| CORS | OK | `ALLOWED_ORIGINS` + `localhost:8080` |
| `PublishRequest` | OK | `userId`, `projectId`, `files`, `slug` |
| `PublishResponse` | OK | `siteUrl`, `deployOk`, `success`, `actionsUrl` |
| HTTP status codes | ⚠️ | Upstream GitHub/Cloud Run/DNS errors → **502** (not 500); 400/403/409/404 as expected |

## Step 4 — Slug in Database

| Item | Status | Detail |
|------|--------|--------|
| `get_site_by_slug` | ⚠️ | Explicit helper name not used; equivalent: `is_publish_slug_taken_by_other_project()` in `site_publish_queries.py` before deployment when DNS is active |
| 409 if taken | OK | Another project already uses the same `publish_slug` |

## Step 5 — Database Creation

| Item | Status | Detail |
|------|--------|--------|
| `deploying` / site status | ⚠️ | Model keeps `status` = draft/generating/ready for **generation**; **publishing** uses `publication_status` = `publishing` → `live` / `failed` |
| `user_prompt` | OK | Populated on `POST /sites/generate` |
| `pending` deployment | OK | `SiteDeployment` created, then progresses through `github_pushed` → `cloud_run_ready` → `success`/`failed` |

## Step 6 — LLM

| Item | Status | Detail |
|------|--------|--------|
| `[{path, content}]` files at publish | ❌ (by design) | Current flow: **generation** produces monolithic HTML → `split_html_to_static_files` on the publish API side — not a direct LLM file list at publish time |

## Steps 7–8 — GitHub

| Item | Status | Detail |
|------|--------|--------|
| Repo `site-{user}-{timestamp}` | OK | `_repo_slug` |
| `auto_init`, sleep 2s | OK | `github_publish_service` |
| Single commit | OK | PyGithub `create_git_tree` + `create_git_commit` + `edit` ref (Git Data API) |
| Dockerfile + workflow | OK | Injected in the same commit |
| `commit_sha` | OK | Returned and stored on `SiteDeployment` |

## Step 9 — GCP Secrets

| Item | Status | Detail |
|------|--------|--------|
| Actions public key | OK | `_put_repo_secret` / GitHub Secrets API |
| Secrets ordered before workflow commit | OK | Secrets are injected **before** the commit that adds `deploy.yml` |

## Step 10 — Cloud Run

| Item | Status | Detail |
|------|--------|--------|
| CI/CD | OK | Generated repository workflow |
| URL polling | OK | `wait_for_cloud_run_url` → `cloud_run_url` in DB |

## Step 11 — Cloudflare

| Item | Status | Detail |
|------|--------|--------|
| CNAME / DNS records | OK | `create_subdomain` |
| Update if exists | OK | PATCH if record already exists |

## Step 12 — Database Update

| Item | Status | Detail |
|------|--------|--------|
| Project fields | OK | `github_repo_url`, `cloud_run_*`, `site_url`, `publish_slug`, `publication_status` |
| Deployment record | OK | `commit_sha`, `status`, `error_message` |

## Step 13 — Frontend Response

| Item | Status | Detail |
|------|--------|--------|
| `siteUrl` + link | OK | Banner + chat message |
| `success` | OK | Field added (mirrors `deployOk`) |

---

## Useful Endpoints

- `GET /api/publish/config` → `{ "requireSlug": true/false }` (aligned with `dns_configured()`)

## Fixes Applied During This Audit

- `publication_status` on `laurena_site_projects` (migration 013).
- Helper `is_publish_slug_taken_by_other_project` + `success` response field.
- `GET /api/publish/config` + frontend `requirePublishSlug`.
- `publication_status` exposed in `GET /api/v1/sites/{id}`.
