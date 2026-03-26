# Laurena Studio — Backend API

FastAPI + PostgreSQL + Stripe multi-tenant SaaS backend.

---

## Quick Start (Docker Compose)

```powershell
# 1. Copy environment file
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# 2. Start everything
docker-compose up --build -d

# 3. Verify
curl http://localhost:8000/health
# → {"status":"ok","app":"Laurena Studio","version":"1.0.0"}

# 4. OpenAPI docs
# http://localhost:8000/docs
```

---

## Architecture

```
backend/
├── app/
│   ├── main.py                 # FastAPI entry point, router registration
│   ├── core/
│   │   ├── config.py           # Pydantic Settings (.env loader)
│   │   ├── dependencies.py     # verify_active_subscription, check_usage, get_workspace_id
│   │   ├── security.py         # JWT creation/verification (python-jose)
│   │   └── google_oauth.py     # Google OAuth2 via Authlib
│   ├── db/
│   │   ├── base.py             # SQLAlchemy DeclarativeBase
│   │   └── session.py          # AsyncSession factory, get_db dependency
│   ├── models/
│   │   ├── user.py             # User model
│   │   ├── workspace.py        # Workspace model (multi-tenant)
│   │   ├── membership.py       # User↔Workspace membership
│   │   ├── plan.py             # SaaS plan definitions (Starter/Pro/Business)
│   │   ├── subscription.py     # Workspace subscription (+ Stripe IDs)
│   │   ├── usage_tracking.py   # Per-workspace resource usage counters
│   │   ├── password_reset.py   # Password reset tokens
│   │   └── google_oauth.py     # Google OAuth linked accounts
│   ├── schemas/
│   │   ├── auth.py             # Auth request/response schemas
│   │   ├── billing.py          # Plan, Subscription, Checkout, Usage schemas
│   │   ├── user.py             # User schemas
│   │   └── workspace.py        # Workspace schemas
│   ├── services/
│   │   ├── auth_service.py     # Register, login, password reset logic
│   │   ├── billing_service.py  # Plan activation, cancellation, usage queries
│   │   └── stripe_service.py   # Stripe SDK wrapper (checkout, portal, webhooks)
│   └── routes/
│       ├── auth.py             # /api/v1/auth/* (register, login, OAuth, workspaces)
│       ├── billing.py          # /api/v1/billing/* (plans, checkout, portal, status)
│       ├── webhook.py          # /api/v1/webhook/stripe (Stripe events)
│       ├── ai.py               # /api/v1/ai/* (protected by subscription)
│       ├── posts.py            # /api/v1/posts/* (protected)
│       ├── social.py           # /api/v1/social/* (protected)
│       ├── ads.py              # /api/v1/ads/* (protected)
│       └── analytics.py        # /api/v1/analytics/* (protected)
├── alembic/
│   └── versions/
│       ├── 001_initial_schema.py
│       ├── 002_add_google_oauth.py
│       ├── 003_add_subscription_system.py
│       └── 004_add_stripe_columns.py
├── Dockerfile
├── requirements.txt
├── .env.example
└── alembic.ini
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://postgres:pw@db:5432/laurenadb` |
| `SECRET_KEY` | JWT signing key (32-byte hex) | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `354...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (for frontend) | `pk_test_...` |
| `STRIPE_PRICE_ID_STARTER` | Stripe Price ID for Starter plan | `price_...` |
| `STRIPE_PRICE_ID_PRO` | Stripe Price ID for Pro plan | `price_...` |
| `STRIPE_PRICE_ID_BUSINESS` | Stripe Price ID for Business plan | `price_...` |
| `FRONTEND_URL` | Frontend base URL (redirects) | `http://localhost:8080` |
| `BACKEND_URL` | Backend base URL (OAuth callback) | `http://localhost:8000` |
| `GOOGLE_INDEXING_ENABLED` | Active l’endpoint manuel d’indexation Google (`/api/v1/indexing/*`) | `true` (défaut) |
| `GOOGLE_INDEXING_DEFER_SECONDS` | Minutes d’attente après Publicar avant le bouton **Indexar** (secondes) | `5400` (1 h 30) |

Publication Cloud Run / DNS : `GCP_SA_KEY`, `GCP_PROJECT_ID`, `ROOT_DOMAIN`, Cloudflare — voir [docs/SITE_BUILDER.md](docs/SITE_BUILDER.md) et **`backend/.env.example`** (section Google Indexing : prérequis GCP + Search Console, redémarrage API après `pip install`).

---

## Stripe Integration

### Flow

```
Frontend                    Backend                         Stripe
   │                          │                               │
   │ POST /billing/create-checkout                            │
   │ { plan_name: "pro" }     │                               │
   │─────────────────────────→│                               │
   │                          │ stripe.checkout.Session.create│
   │                          │──────────────────────────────→│
   │                          │           session URL         │
   │                          │←──────────────────────────────│
   │  { session_id, url }     │                               │
   │←─────────────────────────│                               │
   │                          │                               │
   │  redirect to Stripe URL  │                               │
   │─────────────────────────────────────────────────────────→│
   │                          │                               │
   │                          │  webhook: checkout.session    │
   │                          │         .completed            │
   │                          │←──────────────────────────────│
   │                          │ activate_plan(workspace, plan)│
   │                          │ save stripe_customer_id       │
   │                          │ save stripe_subscription_id   │
   │                          │                               │
   │  redirect to success_url │                               │
   │←─────────────────────────────────────────────────────────│
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/billing/plans` | Public | List all plans with pricing |
| `POST` | `/api/v1/billing/create-checkout` | JWT | Create Stripe Checkout session |
| `POST` | `/api/v1/billing/customer-portal` | JWT | Open Stripe Customer Portal |
| `POST` | `/api/v1/billing/activate-plan` | JWT | Dev/test plan activation |
| `POST` | `/api/v1/billing/cancel` | JWT | Cancel subscription |
| `POST` | `/api/v1/billing/change-plan` | JWT | Switch plan |
| `GET` | `/api/v1/billing/status` | JWT | Get full billing status |
| `GET` | `/api/v1/billing/usage` | JWT | Get usage + remaining limits |
| `POST` | `/api/v1/webhook/stripe` | Stripe sig | Webhook receiver |

### Webhook Events

| Event | Action |
|---|---|
| `checkout.session.completed` (card) | Activate subscription immediately |
| `checkout.session.completed` (boleto) | Wait for async payment confirmation |
| `checkout.session.async_payment_succeeded` | Activate subscription (boleto paid) |
| `checkout.session.async_payment_failed` | Log failure |
| `checkout.session.expired` | Log expiration |
| `customer.subscription.deleted` | Cancel subscription locally |

### Payment Methods

- **Card** — Immediate activation via `checkout.session.completed`
- **Boleto** — Two-step: checkout creates boleto, payment confirmed via `async_payment_succeeded`

### Testing with Stripe CLI

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:8000/api/v1/webhook/stripe

# In another terminal, trigger a test event:
stripe trigger checkout.session.completed
```

---

## Plans & Limits

| Plan | Price (BRL) | Text | Image | Video | Posts | Social |
|---|---|---|---|---|---|---|
| Starter | 29.90 | 50 | 10 | 2 | 30 | 3 |
| Pro | 79.90 | 200 | 50 | 10 | ∞ | 10 |
| Business | 199.90 | ∞ | ∞ | 50 | ∞ | ∞ |

Protected routes (`/ai`, `/posts`, `/social`, `/ads`, `/analytics`) check:
1. Active subscription exists (`verify_active_subscription`)
2. Resource limit not exceeded (`check_and_increment_usage`)

---

## Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Create account + default workspace |
| `POST` | `/api/v1/auth/login` | Public | Email/password login → JWT tokens |
| `POST` | `/api/v1/auth/refresh` | Refresh token | Refresh access token |
| `POST` | `/api/v1/auth/forgot-password` | Public | Generate reset token |
| `POST` | `/api/v1/auth/reset-password` | Public | Reset password with token |
| `GET` | `/api/v1/auth/google` | Public | Start Google OAuth flow |
| `GET` | `/api/v1/auth/google/callback` | Public | Google OAuth callback |
| `GET` | `/api/v1/auth/me` | JWT | Get current user |
| `POST` | `/api/v1/auth/workspaces` | JWT | Create workspace |
| `GET` | `/api/v1/auth/workspaces` | JWT | List user workspaces |
| `POST` | `/api/v1/auth/workspaces/{id}/select` | JWT | Select workspace (new JWT) |

---

## Database Migrations

```powershell
# Run inside Docker:
docker exec laurenastudio-api-1 alembic upgrade head

# Or create a new migration:
docker exec laurenastudio-api-1 alembic revision -m "description"
```

Migrations run automatically on container startup (via Dockerfile entrypoint).

---

## Development

```powershell
# Local Python setup (alternative to Docker)
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Docker hot-reload is enabled via `docker-compose.override.yml` (mounts `backend/` as volume).
