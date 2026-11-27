# Laurena Studio — Functional Snapshot (2026-03-12)
> Stable and functional state of the project as of March 12, 2026.
> Saved Docker images: `laurena-api.tar` / `laurena-frontend.tar`

---

## Table of Contents
1. [Overview](#1-overview)
2. [Global Architecture](#2-global-architecture)
3. [Frontend](#3-frontend)
4. [Backend (API)](#4-backend-api)
5. [Database & Migrations](#5-database--migrations)
6. [Artificial Intelligence](#6-artificial-intelligence)
7. [Authentication](#7-authentication)
8. [Payments (Stripe)](#8-payments-stripe)
9. [Docker Files](#9-docker-files)
10. [Docker Compose](#10-docker-compose)
11. [Configuration — Environment Variables](#11-configuration--environment-variables)
12. [Nginx](#12-nginx)
13. [Cloud Deployment](#13-cloud-deployment)
14. [Restoring from this Snapshot](#14-restoring-from-this-snapshot)
15. [Website Builder (Criar site)](docs/SITE_BUILDER.md)

---

## 1. Overview

**Laurena Studio** is a multi-tenant SaaS marketing content creation platform.
It enables users to generate text, images, and videos with AI, schedule publications,
manage workspaces and teams, build websites, and analyze performance.

| Layer       | Core Technology                      |
|-------------|--------------------------------------|
| Frontend    | React 18 + TypeScript + Vite + TailwindCSS |
| Backend     | Python 3.11 + FastAPI + SQLAlchemy   |
| Database    | PostgreSQL 15                        |
| AI Text/Image | Google Gemini 2.5 Flash / Imagen 3 (Vertex AI) |
| AI Video    | Google Veo / Minimax (Vertex AI)     |
| Auth        | JWT + Google OAuth + Facebook OAuth  |
| Payments    | Stripe                               |
| Deployment  | Docker Compose (local) / Cloud Container (prod) |

---

## 2. Global Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                   │
│         React SPA — port 8080                        │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────┐
│              NGINX (prod) / Vite dev server          │
│  /api/*  →  proxy → FastAPI :8000                    │
│  /uploads/* → proxy → FastAPI :8000                  │
│  /* → index.html (SPA fallback)                      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           FASTAPI BACKEND — port 8000                │
│  Routers: auth, billing, ai, posts, social,          │
│           ads, analytics, media, workspaces,         │
│           search, webhook, sites, oauth              │
│  ORM: SQLAlchemy async + asyncpg                     │
│  Migrations: Alembic                                 │
└────────────┬───────────────┬────────────────────────┘
             │               │
┌────────────▼──┐   ┌────────▼──────────────────────┐
│ PostgreSQL 15 │   │  Google Cloud (Vertex AI)      │
│   port 5432   │   │  - Gemini 2.5 / Imagen 3       │
│   laurenadb   │   │  - Video generation            │
└───────────────┘   └───────────────────────────────┘
```

---

## 3. Frontend

**Location**: `src/`

### Stack
| Package | Version | Role |
|---------|---------|------|
| React | 18.3 | UI framework |
| TypeScript | — | Static typing |
| Vite | — | Bundler + dev server |
| TailwindCSS | 3.4 | Utility styles |
| shadcn/ui + Radix UI | — | Accessible UI components |
| React Router DOM | 6.30 | SPA routing |
| Zustand | 5.0 | Global state management |
| TanStack Query | 5 | Server cache & fetching |
| Axios | 1.13 | HTTP requests |
| React Hook Form + Zod | — | Forms + validation |
| Recharts | 2.15 | Analytics charts |

### Main Pages
| Route | File | Description |
|-------|------|-------------|
| `/` | `Index.tsx` | Landing page |
| `/login` | `Login.tsx` | Sign in |
| `/registro` | `Registro.tsx` | Sign up |
| `/dashboard` | `Dashboard.tsx` | Dashboard |
| `/ai-studio` | `AIStudio.tsx` | AI generation (text + image + video) |
| `/criar-post` | `CriarPost.tsx` | Post creation |
| `/agendador` | `Agendador.tsx` | Scheduler |
| `/biblioteca-midia` | `BibliotecaMidia.tsx` | Media library |
| `/configuracoes` | `Configuracoes.tsx` | Account settings |
| `/escolher-plano` | `EscolherPlano.tsx` | Subscription plan selection |
| `/pagamento` | `Pagamento.tsx` | Stripe payment |

### Global State (Zustand stores)
- `useAuthStore.ts` — authenticated user, JWT tokens
- `useWorkspaceStore.ts` — active workspace
- `useAIStore.ts` — AI generation state

### API Clients
- `src/lib/api.ts` — generic REST calls
- `src/lib/authApi.ts` — auth endpoints
- `src/lib/billingApi.ts` — Stripe endpoints

---

## 4. Backend (API)

**Location**: `backend/app/`

### Structure
```
backend/
├── app/
│   ├── main.py          # FastAPI entry point + middleware + routers
│   ├── core/
│   │   ├── config.py    # Settings (pydantic-settings, .env)
│   │   ├── security.py  # JWT (python-jose) + bcrypt passwords
│   │   ├── dependencies.py  # FastAPI dependencies (get_db, current_user)
│   │   ├── google_oauth.py  # Google OAuth (Authlib)
│   │   └── facebook_oauth.py # Facebook OAuth
│   ├── db/
│   │   └── base.py      # Async SQLAlchemy engine
│   ├── models/          # SQLAlchemy ORM tables
│   ├── schemas/         # Pydantic schemas (request/response)
│   ├── routes/          # FastAPI routers
│   └── services/
│       └── ai_service.py  # Vertex AI integration
├── alembic/             # DB migrations
├── alembic.ini
└── requirements.txt
```

### Routers (prefix `/api/v1`)
| Router | File | Responsibility |
|--------|------|----------------|
| `/auth` | `auth.py` | Register, login, refresh, OAuth |
| `/billing` | `billing.py` | Plans, Stripe subscriptions |
| `/ai` | `ai.py` | Text / image / video generation |
| `/posts` | `posts.py` | Posts CRUD |
| `/social` | `social.py` | Social network connections |
| `/ads` | `ads.py` | Ad management |
| `/analytics` | `analytics.py` | Metrics & stats |
| `/media` | `media.py` | Media uploads |
| `/workspaces` | `workspaces.py` | Workspaces & members |
| `/search` | `search.py` | Content search |
| `/webhook` | `webhook.py` | Stripe webhooks |

### Data Models
| Model | File | Description |
|-------|------|-------------|
| User | `user.py` | User account |
| Workspace | `workspace.py` | Workspace |
| Membership | `membership.py` | User ↔ workspace relationship |
| Plan | `plan.py` | Subscription plans |
| Subscription | `subscription.py` | Active subscription |
| AIGeneration | `ai_generation.py` | AI generation history |
| Media | `media.py` | Uploaded files |
| UsageTracking | `usage_tracking.py` | Quota consumption |
| PasswordReset | `password_reset.py` | Password reset tokens |

### Python Dependencies (`requirements.txt`)
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9
SQLAlchemy>=2.0.30
asyncpg>=0.29.0          # async driver (runtime)
pg8000>=1.31.0            # sync driver (Alembic migrations)
alembic>=1.13.1
passlib[bcrypt]>=1.7.4
bcrypt>=4.0.0,<5.0.0     # incompatible with passlib if >=5
python-jose[cryptography]>=3.3.0
authlib>=1.3.0            # Google/Facebook OAuth
httpx>=0.27.0
itsdangerous>=2.1.0       # SessionMiddleware
stripe>=8.0.0
pydantic>=2.10.0
pydantic-settings>=2.6.0
python-dotenv>=1.0.0
email-validator>=2.1.1
google-genai>=1.0.0       # Gemini SDK
aiofiles>=24.1.0
```

---

## 5. Database & Migrations

**DBMS**: PostgreSQL 15  
**ORM**: SQLAlchemy 2.x (async with asyncpg)  
**Migrations**: Alembic

### Migration History
| Revision | File | Content |
|----------|------|---------|
| 001 | `001_initial_schema.py` | users, workspaces, memberships, password_resets |
| 002 | `002_add_google_oauth.py` | google_id, avatar_url on users |
| 003 | `003_add_subscription_system.py` | plans, subscriptions |
| 004 | `004_add_stripe_columns.py` | stripe_customer_id, stripe_subscription_id |
| 005 | `005_add_user_profile_fields.py` | name, bio, phone... |
| 006 | `006_add_workspace_limit_to_plans.py` | workspace_limit on plans |
| 007 | `007_add_ai_generations_and_media.py` | ai_generations, media |
| 008 | `008_add_facebook_oauth.py` | facebook_id on users |

### Apply Migrations
```bash
alembic upgrade head
```

---

## 6. Artificial Intelligence

**File**: `backend/app/services/ai_service.py`

### Distinct Clients

| Client | Variable | Credential | Model |
|--------|----------|-----------|-------|
| Text + Image | `_client` | API Key (`GOOGLE_CLOUD_API_KEY`) / Vertex AI | `gemini-2.5-flash` / Imagen 3 |
| Video | `_video_client` | Service Account JSON / ADC | Vertex AI Video Generation |

### Vertex AI Credentials (priority order)
1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable → file exists
2. Local user ADC (gcloud):
    - Windows: `%APPDATA%/gcloud/application_default_credentials.json`
    - Linux/macOS: `~/.config/gcloud/application_default_credentials.json`
3. Default Docker ADC: `/root/.config/gcloud/application_default_credentials.json`
4. `GOOGLE_CREDENTIALS_JSON` environment variable (raw JSON or base64) → written to a temporary file

If you see `Your default credentials were not found`, run:
`gcloud auth application-default login`

### Generated Files Storage
- Images: `backend/uploads/generated/<uuid>.png`
- Videos: `backend/uploads/videos/<uuid>.mp4`
- Served via FastAPI StaticFiles: `/uploads/...`

---

## 7. Authentication

- **JWT** (`python-jose`): access token (15 min) + refresh token (7 days)
- **Bcrypt** (`passlib`): password hashing
- **Google OAuth 2.0** (`authlib`): callback `/api/v1/auth/google/callback`
- **Facebook OAuth** (`authlib`): callback `/api/v1/auth/facebook/callback`
- **SessionMiddleware** (`itsdangerous`): required for the OAuth flow (CSRF state)

---

## 8. Payments (Stripe)

- SDK: `stripe>=8.0.0`
- Plans: Starter / Pro / Business (defined by `STRIPE_PRICE_ID_*`)
- Stripe Webhooks → `/api/v1/webhook/stripe`
- Customer portal and checkout session managed by `billing.py`

---

## 9. Docker Files

### `backend/Dockerfile` — FastAPI API
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get install gcc libpq-dev   # asyncpg / bcrypt / cryptography
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ .
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```
> Build context: **project root** (not `backend/`)

### `Dockerfile.frontend` — Frontend dev
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### `Dockerfile.frontend.prod` — Frontend production (multi-stage)
```dockerfile
# Stage 1: Build React → /app/dist
FROM node:20-slim AS build
RUN npm ci && npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

---

## 10. Docker Compose

### `docker-compose.yml` — Local Development

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `db` | `postgres:15` | 5432 | PostgreSQL + healthcheck |
| `redis` | `redis:7-alpine` | 6379 | Redis (ARQ job queue) |
| `api` | build `backend/Dockerfile` | 8000 | FastAPI + `--reload` |
| `worker` | build `backend/Dockerfile` | — | ARQ background worker |
| `frontend` | build `Dockerfile.frontend` | 8080 | Vite dev server |

- `api` depends on `db` and `redis` (condition: `service_healthy`)
- `db_data` volume for PostgreSQL persistence
- Google ADC mounted read-only: `%APPDATA%/gcloud/...`

---

## 11. Configuration — Environment Variables

Local file: `backend/.env` (copy from `backend/.env.example`)  
Production: Cloud App Settings / Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Async PostgreSQL URL | `postgresql+asyncpg://user:pass@host/db` |
| `SECRET_KEY` | JWT signing key (256-bit) | `openssl rand -hex 32` |
| `SESSION_SECRET_KEY` | Starlette session signing | `openssl rand -hex 32` |
| `FRONTEND_URL` | Frontend URL (CORS + OAuth redirect) | `https://myapp.com` |
| `BACKEND_URL` | Backend URL (OAuth callback) | `https://api.myapp.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | from console.cloud.google.com |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | from console.cloud.google.com |
| `FACEBOOK_APP_ID` | Facebook OAuth App ID | from developers.facebook.com |
| `FACEBOOK_APP_SECRET` | Facebook OAuth App Secret | from developers.facebook.com |
| `GOOGLE_CLOUD_API_KEY` | Gemini text/image API key | from Google Cloud Console |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | `my-project-123456` |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region | `us-central1` |
| `GOOGLE_CREDENTIALS_JSON` | Service account JSON (base64 supported) | for Vertex AI without ADC |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_PRICE_ID_STARTER` | Stripe Price ID for Starter plan | `price_...` |
| `STRIPE_PRICE_ID_PRO` | Stripe Price ID for Pro plan | `price_...` |
| `STRIPE_PRICE_ID_BUSINESS` | Stripe Price ID for Business plan | `price_...` |
| `SMTP_USERNAME` | Outbound email username | `no-reply@myapp.com` |
| `SMTP_PASSWORD` | SMTP password | — |
| `SMTP_FROM_EMAIL` | "From" email address | `no-reply@myapp.com` |
| `ALLOWED_ORIGINS` | Additional CORS origins | `https://myapp.com` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON path (dev) | `/root/.config/gcloud/...` |

---

## 12. Nginx

**File**: `nginx.conf`  
Used in `Dockerfile.frontend.prod` and combined production builds.

| Location | Behavior |
|----------|----------|
| `/api/*` | Proxy → `localhost:8000` |
| `/uploads/*` | Proxy → `localhost:8000` |
| `/health`, `/docs`, `/redoc`, `/openapi.json` | Proxy → `localhost:8000` |
| `/*` | `try_files` → SPA fallback `index.html` |

- Gzip enabled for CSS, JS, JSON, SVG
- Proxy timeout: 600s (for long video/site generation requests)

---

## 13. Cloud Deployment

- **Registry**: GitHub Container Registry (`ghcr.io`) / Azure Container Registry
- **Compute**: Combined Docker container (Nginx + FastAPI + ARQ + Supervisord)
- **Database**: Managed PostgreSQL
- **Secrets**: Injected as environment variables at runtime

---

## 14. Restoring from this Snapshot

### Restore Docker Images
```bash
docker load -i laurena-api.tar
docker load -i laurena-frontend.tar
```

### Verify Integrity
```bash
sha256sum -c checksums.txt
```

### Restart Local Environment
```bash
# Copy backend/.env.example to backend/.env and fill in the variables from Section 11
cd laurenastudio
docker compose up
```

### Reinstall Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Reinstall Node Dependencies
```bash
npm install
```

---

*Snapshot created on 2026-03-12 — Laurena Studio v1.0.0*
