# Website Builder — "Criar site" (Implementation Guide)

This document summarizes the architecture of the **site builder** (Laurena chat + HTML generation via Gemini),
connected to the `/criar-site` frontend and the FastAPI backend.

---

## Overview

| Layer | Files / Location |
|-------|------------------|
| **DB** | `laurena_site_projects`, `laurena_site_prompts`, `laurena_generated_sites` |
| **Migrations** | `009_…` (history) + **`010_laurena_site_builder_tables.py`** (actual tables; avoids conflict with legacy `site_projects` linked to `users.owner_id`) |
| **AI Chat + Structure** | `backend/app/services/site_ai_service.py` |
| **HTML (Jinja)** | `backend/app/services/site_generator.py` |
| **REST Routes** | `backend/app/routes/sites.py` |
| **Pydantic Schemas** | `backend/app/schemas/site.py` |
| **ORM Models** | `backend/app/models/site_project.py` |
| **Frontend** | `src/pages/CriarSite.tsx` → `POST /api/v1/sites/*` |

---

## Database (3 Tables)

| Table | Role | Relationships |
|-------|------|---------------|
| `laurena_site_projects` | One project = one website | `workspace_id` → `workspaces` |
| `laurena_site_prompts` | Chat messages | `project_id` → `laurena_site_projects` |
| `laurena_generated_sites` | JSON + HTML | `project_id` → `laurena_site_projects` (1:1) |

---

## AI Module (`site_ai_service.py`)

- **`generate_chat_reply()`** — Gemini (`gemini-2.5-flash`), conversational mode, "Laurena" persona, concise replies in the same language as the user.
- **`generate_site_structure()`** — Gemini model with a system prompt enforcing **strict JSON**: `site_name`, `description`, `primary_color`, `font`, `sections[]` (hero, features, faq, etc.). JSON validated in Python.

Gemini client: aligned with the rest of the backend (`google-genai`, `_get_client()` / Vertex credentials).

---

## HTML Generator (`site_generator.py`)

- Embedded **Jinja2** template → responsive HTML/CSS page (hero, features, pricing, FAQ, contact, CTA, footer, etc.).
- **`save_site()`** → `uploads/sites/<project_id>/index.html` + `structure.json`.
- **`create_zip()`** — In-memory ZIP archive for download.

> **Jinja Note**: uses `section.get("items", [])` rather than `section.items` (to avoid colliding with Python's `dict.items()` method).

---

## FastAPI Routes (`/api/v1/sites/…`)

| Method | Endpoint | Role |
|--------|----------|------|
| `POST` | `/sites/chat` | Chat + creates `project_id` on the first message |
| `POST` | `/sites/generate` | Generates the site from the briefing (aggregated user messages) |
| `GET` | `/sites/{project_id}` | Status, preview URL, errors |
| `GET` | `/sites/{project_id}/download` | ZIP download |
| `GET` | `/sites/` | Lists workspace projects |

Access control: `verify_active_subscription` + `check_and_increment_usage` (`text` quota).

---

## Frontend (`CriarSite.tsx`)

- Calls **`POST /sites/chat`** with message history + `project_id` after the first reply.
- **"Gerar site"** button → **`POST /sites/generate`**.
- **Preview** (`/uploads/sites/.../index.html`) and **Download** (`/sites/{id}/download`) links.
- On-screen error handling.

HTTP client: `src/lib/api.ts` (`baseURL: /api/v1`, Bearer JWT).

---

## Publishing (`POST /api/publish`) — GitHub Actions & Cloudflare

The **GitHub Actions workflow** deploys the generated site to **Cloud Run** (builds and pushes the container image). It does **not** create the subdomain itself.

After the API retrieves the Cloud Run service URL (`wait_for_cloud_run_url`), **the FastAPI handler** calls **Cloudflare** (`dns_service.create_subdomain`) to configure DNS records for `slug` → Cloud Run, provided `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONE_ID`, and `ROOT_DOMAIN` are set (`dns_configured()`). Otherwise, `siteUrl` in the response defaults to the direct **`.run.app`** URL.

- `GET /api/publish/config` → `{ requireSlug: true }` when Cloudflare is configured (the frontend then requires a slug).
- The response includes `dnsApplied`, `siteUrl`, and `cloudRun` to distinguish the canonical URL from the direct Cloud Run URL.

### Subdomain Automation (GCP + Cloudflare)

After Cloud Run deployment, `POST /api/publish` performs:

1. **Domain mapping** via the `domains.cloudrun.com/v1` API on the **regional host** `https://{GCP_REGION}-run.googleapis.com/...` (using `run.googleapis.com` directly fails with 404). Uses the same `GCP_SA_KEY` / project as Cloud Run polling.
2. Reads the **`resourceRecords`** returned by Google (A / AAAA / CNAME / TXT as applicable).
3. **Cloudflare update**: removes stale records for that subdomain, then creates the records required by Google with **`proxied: false` (DNS only, grey cloud)**. Using **proxied** mode toward `ghs.googlehosted.com` / Google IPs often causes **Cloudflare Error 525** (TLS handshake failure between Cloudflare and Google origin).

Useful variables: `GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS`, `GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS`.

In case of failure (IAM, quotas), the HTTP error message instructs checking **Cloud Run → Domain mappings** and `run.domainmappings.*` permissions (typically covered by `roles/run.admin` on the project for the `GCP_SA_KEY` service account).

**Diagnostics (`GET …/domainmappings/{fqdn}` API response)**:

- If `reason: PermissionDenied` + *"Caller is not authorized to administer the domain"*: the **caller** is the `client_email` of **`GCP_SA_KEY`**, not your personal `gcloud` user. It must be added as a verified **Owner** of the domain property in Google Search Console (root domain or parent domain).
- **Observed behavior**: after adding the owner in Search Console, a mapping that was **already created** may retain `PermissionDenied` until the mapping is **deleted and recreated**. A `DELETE` followed by a new `POST` transitions the API to `DomainRoutable` + `resourceRecords` (e.g., CNAME to `ghs.googlehosted.com`).
- Next, the message *"You must configure your DNS records for certificate issuance"* indicates that those DNS records must be applied at the DNS provider (handled automatically by the Cloudflare step after `POST /api/publish`).

**Error 525** on `https://slug.domain`: switch the record to **DNS only** in Cloudflare (or republish after updating the API). Do not use the orange proxy cloud for Google domain mapping targets.

---

## Tests

- **Frontend**: `npm run test` — `CriarSite.test.tsx` (mock API), `criarSiteChat.test.ts`.
- **Backend — publish + mapping contract (Docker)**:
  ```bash
  docker compose exec api python scripts/verify_publish_automation.py
  ```
  Verifies: `PublishResponse` (`siteUrl`, `dnsApplied`), `https://{slug}.{ROOT_DOMAIN}` format, `dns_configured()`, plus `unittest test_domain_mapping_automation` + `pytest test_dns_google_names.py`.
- **Mapping + Cloudflare only** (without GitHub): `docker compose exec api python scripts/test_mapping_zar.py` — default slug `zar`, Cloud Run service = latest listed or `TEST_CLOUD_RUN_SERVICE_NAME`. Option: `TEST_MAPPING_POLL_MAX_SECONDS=1800` if Google certificate provisioning takes longer than 15 minutes.
- **Public config**: `GET /api/publish/config` → `{ "requireSlug": true }` when Cloudflare + `ROOT_DOMAIN` are configured.

### Monitoring a Long Publish (E2E / Criar site)

- A single `POST /api/publish` request stays **open** until completion (GitHub → Actions → Cloud Run → domain mapping → Cloudflare), which can take **15–40 minutes**.
- **Live tracking**: in a second terminal, run `docker compose logs -f api` and look for lines prefixed with **`[publish]`** (`GitHub push OK`, `polling Cloud Run`, `still waiting for Cloud Run`, `domain mapping + Cloudflare`, `waiting for … Ready`, `done site_url=…`).
- **Warning**: with `uvicorn --reload` (default in dev compose), **saving a file** under `./backend` restarts the API and **aborts** any in-flight publish request. Avoid saving backend files during a long test, or run the API without `--reload` for E2E runs.
- **`oauth2.googleapis.com` / `SSLEOFError` / `Max retries` error**: the backend refreshes an OAuth token to call GCP APIs. Transient TLS drops can happen under Docker on Windows, VPNs, or proxies. The code automatically retries token refreshes; if the error persists, verify system clock sync or disable HTTPS inspection on your proxy/antivirus.

---

## Docker — Rebuild and Test

From the repository root:

```bash
docker compose build --no-cache api frontend
docker compose up -d
```

Then:

- API: <http://localhost:8000/health> and <http://localhost:8000/docs> (**Site Builder** tag).
- Frontend: <http://localhost:8080/criar-site> (requires account + active plan).
- Migrations: `alembic upgrade head` runs on `api` container startup.

**Secrets**: `GOOGLE_CLOUD_API_KEY` (and Vertex AI configuration) in `backend/.env` for Gemini calls.

**Text model**: optional variable `GEMINI_TEXT_MODEL` (default: `gemini-2.5-flash` in `app/core/config.py`).

---

## Implementation Timeline (Summary)

1. SQLAlchemy models + migration `009` / `010`.
2. AI service + Jinja generator + local storage under `uploads/sites/`.
3. FastAPI router registered in `app/main.py`.
4. **Jinja2** dependency added to `backend/requirements.txt`.
5. Frontend connected to the live API.

---

## GitHub Publishing (`POST /api/publish`)

After generation, the frontend sends **`userId`**, **`projectId`**, and an empty **`files`** array: the backend reads `uploads/sites/<project_id>/index.html`, splits it into `index.html` + `styles.css` + `app.js`, creates a private repository `site-{userId}-{timestamp}`, pushes a **single commit** (Git Data API) including `Dockerfile` (nginx:8080), `.dockerignore`, and `.github/workflows/deploy.yml` (Cloud Run), and injects the GitHub Actions secrets **GCP_SA_KEY** and **GCP_PROJECT_ID** (LibSodium / PyNaCl encryption).

| `.env` Variable | Role |
|-----------------|------|
| `GITHUB_TOKEN` | PAT with **repo** and **workflow** scopes; `site-*` repositories are created as **private** |
| `GITHUB_OWNER` | Target GitHub account or organization |
| `GCP_PROJECT_ID` | Google Cloud Project ID |
| `GCP_SA_KEY` | Full Service Account JSON (or base64-encoded JSON) |
| `GCP_REGION` | `gcloud run deploy` region (default `us-central1`) |
| `GOOGLE_INDEXING_ENABLED` | `true` / `false` — enables the manual `/api/v1/indexing/request` endpoint (default `true`) |
| `GOOGLE_INDEXING_DEFER_SECONDS` | Wait time in seconds after clicking **Publicar** before the user can trigger indexing from **Indexar** (default **5400** = 1h 30m) |

Python packages: `PyGithub`, `PyNaCl`, `google-api-python-client` (Indexing API — see `backend/requirements.txt`).

### Google Indexing API (**Indexar** Page, After **Publicar**)

On **`POST /api/publish`** for a project, the API records **`last_publish_enqueue_at`** (click timestamp). On the **`/indexar`** app page, the user chooses per site whether to notify Google; the "Request indexing" (`Pedir indexação`) button becomes active after **`GOOGLE_INDEXING_DEFER_SECONDS`** has elapsed. The URL **`https://{slug}.{ROOT_DOMAIN}/`** is then sent to the [Indexing API v3](https://developers.google.com/search/apis/indexing-api/v3/using-api) (`URL_UPDATED`) via **`POST /api/v1/indexing/request`**, using the same **`GCP_SA_KEY`** (or **`GOOGLE_CREDENTIALS_JSON`**) as Cloud Run. **`GET /api/v1/indexing/overview`** lists projects and their eligibility.

**Prerequisites**: enable the **Web Search Indexing API** in Google Cloud Console on the project; in Google Search Console, the service account **`client_email`** must be a verified **Owner** of the property covering **`*.ROOT_DOMAIN`** (typically a **Domain** property on the root domain). Otherwise, the API returns **403**. To disable: `GOOGLE_INDEXING_ENABLED=false`.

**Implementation note**: GitHub Actions secrets (`GCP_SA_KEY`, `GCP_PROJECT_ID`) are created **before** the commit that adds `deploy.yml`. The workflow does **not** call `gcloud services enable` because that command requires **Service Usage Admin** (`roles/serviceusage.serviceUsageAdmin`) or **Owner**, which the deployer service account typically does not have.

### One-Time GCP Setup (Owner or `roles/serviceusage.serviceUsageAdmin`)

In Cloud Shell or with `gcloud` authenticated as your admin user:

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=YOUR_PROJECT_ID
```

On **Windows**, you can use the interactive setup script: [scripts/gcp-setup-once.ps1](../scripts/gcp-setup-once.ps1).

The workflow then runs `gcloud run deploy --source .` with `project_id` in the `auth` action.

**Recommended GCP IAM Roles** for `gcloud run deploy --source .` (service account e.g. `github-deployer@…`):
- **`roles/artifactregistry.writer`** (required for the `cloud-run-source-deploy` repository)
- `roles/run.admin`
- `roles/cloudbuild.builds.editor`
- `roles/storage.objectAdmin`
- **Service Account User** on `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
See helper script: [scripts/gcp-grant-github-deployer-roles.ps1](../scripts/gcp-grant-github-deployer-roles.ps1).

*Last updated: March 2026.*
