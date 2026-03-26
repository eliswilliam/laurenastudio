# Laurena Studio — Snapshot fonctionnel 12/03/2026
> État stable et fonctionnel du projet à la date du 12 mars 2026.
> Images Docker sauvegardées : `laurena-api.tar` / `laurena-frontend.tar`

---

## Table des matières
1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture globale](#2-architecture-globale)
3. [Frontend](#3-frontend)
4. [Backend (API)](#4-backend-api)
5. [Base de données & Migrations](#5-base-de-données--migrations)
6. [Intelligence Artificielle](#6-intelligence-artificielle)
7. [Authentification](#7-authentification)
8. [Paiements (Stripe)](#8-paiements-stripe)
9. [Fichiers Docker](#9-fichiers-docker)
10. [Docker Compose](#10-docker-compose)
11. [Configuration — Variables d'environnement](#11-configuration--variables-denvironnement)
12. [Nginx](#12-nginx)
13. [Déploiement Azure](#13-déploiement-azure)
14. [Restauration depuis ce snapshot](#14-restauration-depuis-ce-snapshot)
15. [Générateur de sites (Criar site)](docs/SITE_BUILDER.md)

---

## 1. Vue d'ensemble

**Laurena Studio** est une plateforme SaaS multi-tenant de création de contenu marketing.
Elle permet de générer du texte, des images et des vidéos par IA, de planifier des publications,
de gérer des workspaces et des équipes, et d'analyser les performances.

| Couche       | Technologie principale               |
|-------------|--------------------------------------|
| Frontend    | React 18 + TypeScript + Vite + TailwindCSS |
| Backend     | Python 3.11 + FastAPI + SQLAlchemy   |
| Base de données | PostgreSQL 15                    |
| IA texte/image | Google Gemini 2.5 Flash Image (Vertex AI) |
| IA vidéo    | Google Minimax 3.1 (Vertex AI)           |
| Auth        | JWT + Google OAuth + Facebook OAuth  |
| Paiements   | Stripe                               |
| Déploiement | Docker Compose (local) / Azure Container Apps (prod) |

---

## 2. Architecture globale

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
│           search, webhook                            │
│  ORM: SQLAlchemy async + asyncpg                     │
│  Migrations: Alembic (001 → 008)                     │
└────────────┬───────────────┬────────────────────────┘
             │               │
┌────────────▼──┐   ┌────────▼──────────────────────┐
│ PostgreSQL 15 │   │  Google Cloud (Vertex AI)      │
│   port 5432   │   │  - Gemini 2.5 Flash Image      │
│   laurenadb   │   │  - Minimax 3.1 (vidéo)             │
└───────────────┘   └───────────────────────────────┘
```

---

## 3. Frontend

**Localisation**: `src/`

### Stack
| Package | Version | Rôle |
|---------|---------|------|
| React | 18.3 | UI framework |
| TypeScript | — | Typage statique |
| Vite | — | Bundler + dev server |
| TailwindCSS | 3.4 | Styles utilitaires |
| shadcn/ui + Radix UI | — | Composants UI accessibles |
| React Router DOM | 6.30 | Routing SPA |
| Zustand | 5.0 | State management global |
| TanStack Query | 5 | Cache & fetching serveur |
| Axios | 1.13 | Requêtes HTTP |
| React Hook Form + Zod | — | Formulaires + validation |
| Recharts | 2.15 | Graphiques analytics |

### Pages principales
| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | `Index.tsx` | Landing page |
| `/login` | `Login.tsx` | Connexion |
| `/registro` | `Registro.tsx` | Inscription |
| `/dashboard` | `Dashboard.tsx` | Tableau de bord |
| `/ai-studio` | `AIStudio.tsx` | Génération IA (texte + image + vidéo) |
| `/criar-post` | `CriarPost.tsx` | Création de post |
| `/agendador` | `Agendador.tsx` | Planificateur |
| `/biblioteca-midia` | `BibliotecaMidia.tsx` | Bibliothèque médias |
| `/configuracoes` | `Configuracoes.tsx` | Paramètres compte |
| `/escolher-plano` | `EscolherPlano.tsx` | Choix d'abonnement |
| `/pagamento` | `Pagamento.tsx` | Paiement Stripe |

### State global (Zustand stores)
- `useAuthStore.ts` — utilisateur connecté, tokens JWT
- `useWorkspaceStore.ts` — workspace actif
- `useAIStore.ts` — état génération IA

### API clients
- `src/lib/api.ts` — appels REST génériques
- `src/lib/authApi.ts` — auth endpoints
- `src/lib/billingApi.ts` — Stripe endpoints

---

## 4. Backend (API)

**Localisation**: `backend/app/`

### Structure
```
backend/
├── app/
│   ├── main.py          # Point d'entrée FastAPI + middleware + routers
│   ├── core/
│   │   ├── config.py    # Settings (pydantic-settings, .env)
│   │   ├── security.py  # JWT (python-jose) + bcrypt passwords
│   │   ├── dependencies.py  # Dépendances FastAPI (get_db, current_user)
│   │   ├── google_oauth.py  # OAuth Google (Authlib)
│   │   └── facebook_oauth.py # OAuth Facebook
│   ├── db/
│   │   └── base.py      # SQLAlchemy engine async
│   ├── models/          # Tables ORM SQLAlchemy
│   ├── schemas/         # Pydantic schemas (request/response)
│   ├── routes/          # Routers FastAPI
│   └── services/
│       └── ai_service.py  # Gemini + Minimax intégration
├── alembic/             # Migrations DB
├── alembic.ini
└── requirements.txt
```

### Routers (préfixe `/api/v1`)
| Router | Fichier | Responsabilité |
|--------|---------|----------------|
| `/auth` | `auth.py` | Register, login, refresh, OAuth |
| `/billing` | `billing.py` | Plans, abonnements Stripe |
| `/ai` | `ai.py` | Génération texte / image / vidéo |
| `/posts` | `posts.py` | CRUD posts |
| `/social` | `social.py` | Connexions réseaux sociaux |
| `/ads` | `ads.py` | Gestion publicités |
| `/analytics` | `analytics.py` | Métriques & stats |
| `/media` | `media.py` | Upload médias |
| `/workspaces` | `workspaces.py` | Workspaces & membres |
| `/search` | `search.py` | Recherche contenus |
| `/webhook` | `webhook.py` | Webhooks Stripe |

### Modèles de données
| Modèle | Fichier | Description |
|--------|---------|-------------|
| User | `user.py` | Compte utilisateur |
| Workspace | `workspace.py` | Espace de travail |
| Membership | `membership.py` | Relation user ↔ workspace |
| Plan | `plan.py` | Plans d'abonnement |
| Subscription | `subscription.py` | Abonnement actif |
| AIGeneration | `ai_generation.py` | Historique générations IA |
| Media | `media.py` | Fichiers uploadés |
| UsageTracking | `usage_tracking.py` | Consommation quotas |
| PasswordReset | `password_reset.py` | Tokens reset mot de passe |

### Dépendances Python (`requirements.txt`)
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9
SQLAlchemy>=2.0.30
asyncpg>=0.29.0          # driver async (runtime)
pg8000>=1.31.0            # driver sync (Alembic migrations)
alembic>=1.13.1
passlib[bcrypt]>=1.7.4
bcrypt>=4.0.0,<5.0.0     # incompatible avec passlib si >=5
python-jose[cryptography]>=3.3.0
authlib>=1.3.0            # Google/Facebook OAuth
httpx>=0.27.0
itsdangerous>=2.1.0       # SessionMiddleware
stripe>=8.0.0
pydantic>=2.10.0
pydantic-settings>=2.6.0
python-dotenv>=1.0.0
email-validator>=2.1.1
google-genai>=1.0.0       # SDK Gemini + Minimax
aiofiles>=24.1.0
```

---

## 5. Base de données & Migrations

**SGBD**: PostgreSQL 15  
**ORM**: SQLAlchemy 2.x (async avec asyncpg)  
**Migrations**: Alembic

### Historique des migrations
| Révision | Fichier | Contenu |
|----------|---------|---------|
| 001 | `001_initial_schema.py` | users, workspaces, memberships, password_resets |
| 002 | `002_add_google_oauth.py` | google_id, avatar_url sur users |
| 003 | `003_add_subscription_system.py` | plans, subscriptions |
| 004 | `004_add_stripe_columns.py` | stripe_customer_id, stripe_subscription_id |
| 005 | `005_add_user_profile_fields.py` | name, bio, phone... |
| 006 | `006_add_workspace_limit_to_plans.py` | workspace_limit sur plans |
| 007 | `007_add_ai_generations_and_media.py` | ai_generations, media |
| 008 | `008_add_facebook_oauth.py` | facebook_id sur users |

### Appliquer les migrations
```bash
alembic upgrade head
```

---

## 6. Intelligence Artificielle

**Fichier**: `backend/app/services/ai_service.py`

### Deux clients distincts

| Client | Variable | Credential | Modèle |
|--------|----------|-----------|--------|
| Texte + Image | `_client` | API Key (`GOOGLE_CLOUD_API_KEY`) | `gemini-2.5-flash-image` |
| Vidéo | `_video_client` | Service Account JSON / ADC | `Minimax-3.1-generate-001` |

### Génération de texte & image (`_sync_generate`)
```python
GenerateContentConfig(
    temperature=1,
    top_p=0.95,
    max_output_tokens=32768,
    response_modalities=["TEXT", "IMAGE"],
    safety_settings=[...tous à "OFF"...],
    image_config=ImageConfig(aspect_ratio="1:1", image_size="1K"),
)
# Modèle: gemini-2.5-flash-image
# Stream: generate_content_stream
```

### Génération vidéo Minimax 3.1 (`_sync_generate_video`)
```python
GenerateVideosConfig(
    aspect_ratio="16:9",
    number_of_videos=1,
    duration_seconds=8,
    person_generation="allow_all",
    generate_audio=True,
)
# Modèle: Minimax-3.1-generate-001
# Polling toutes les 10s, timeout 5 min (300s)
# Sauvegarde: uploads/videos/<uuid>.mp4
```

### Credentials Vertex AI (ordre de priorité)
1. Variable `GOOGLE_APPLICATION_CREDENTIALS` → fichier existe
2. ADC par défaut Docker: `/root/.config/gcloud/application_default_credentials.json`
3. Variable `GOOGLE_CREDENTIALS_JSON` (JSON ou base64) → écrit dans `/tmp/gcloud_sa_key.json`

### Fichiers générés sauvegardés dans
- Images: `backend/uploads/generated/<uuid>.png`
- Vidéos: `backend/uploads/videos/<uuid>.mp4`
- Servis via FastAPI StaticFiles: `/uploads/...`

---

## 7. Authentification

- **JWT** (`python-jose`): access token (15 min) + refresh token (7 jours)
- **Bcrypt** (`passlib`): hashage des mots de passe
- **Google OAuth 2.0** (`authlib`): callback `/api/v1/auth/google/callback`
- **Facebook OAuth** (`authlib`): callback `/api/v1/auth/facebook/callback`
- **SessionMiddleware** (`itsdangerous`): nécessaire pour le flow OAuth (state CSRF)

---

## 8. Paiements (Stripe)

- SDK: `stripe>=8.0.0`
- Plans: Starter / Pro / Business (définis par `STRIPE_PRICE_ID_*`)
- Webhooks Stripe → `/api/v1/webhook/stripe`
- Customer portal, checkout session gérés par `billing.py`

---

## 9. Fichiers Docker

### `backend/Dockerfile` — API FastAPI
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
> Context de build: **racine du projet** (pas `backend/`)

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

# Stage 2: Serve avec Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

---

## 10. Docker Compose

### `docker-compose.yml` — Développement local

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `db` | `postgres:15` | 5432 | PostgreSQL + healthcheck |
| `api` | build `backend/Dockerfile` | 8000 | FastAPI + `--reload` |
| `frontend` | build `Dockerfile.frontend` | 8080 | Vite dev server |

- `api` dépend de `db` (condition: `service_healthy`)
- Volume `db_data` pour la persistance PostgreSQL
- ADC Google monté en lecture seule: `%APPDATA%/gcloud/...`

### `docker-compose.azure.yml` — Production Azure

| Service | Image (ACR) | Description |
|---------|-------------|-------------|
| `api` | `laurenastudio.azurecr.io/laurena-api:<sha>` | API FastAPI |
| `frontend` | `laurenastudio.azurecr.io/laurena-frontend:<sha>` | Nginx + React |

- **Pas de service `db`** → Azure Database for PostgreSQL (VNet privé)
- Toutes les variables injectées via Azure App Settings

---

## 11. Configuration — Variables d'environnement

Fichier local: `backend/.env`  
En production: Azure App Settings

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL async | `postgresql+asyncpg://user:pass@host/db` |
| `SECRET_KEY` | JWT signing key (256-bit) | `openssl rand -hex 32` |
| `SESSION_SECRET_KEY` | Starlette session signing | `openssl rand -hex 32` |
| `FRONTEND_URL` | URL frontend (CORS + OAuth redirect) | `https://monapp.com` |
| `BACKEND_URL` | URL backend (OAuth callback) | `https://api.monapp.com` |
| `GOOGLE_CLIENT_ID` | OAuth Google | depuis console.cloud.google.com |
| `GOOGLE_CLIENT_SECRET` | OAuth Google | depuis console.cloud.google.com |
| `FACEBOOK_APP_ID` | OAuth Facebook | depuis developers.facebook.com |
| `FACEBOOK_APP_SECRET` | OAuth Facebook | depuis developers.facebook.com |
| `GOOGLE_CLOUD_API_KEY` | Clé API Gemini texte/image | depuis Google Cloud Console |
| `GOOGLE_CLOUD_PROJECT` | ID projet GCP (pour Minimax) | `mon-projet-123456` |
| `GOOGLE_CLOUD_LOCATION` | Région Vertex AI | `us-central1` |
| `GOOGLE_CREDENTIALS_JSON` | Service account JSON (base64 OK) | pour Minimax 3.1 sans ADC |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe | `whsec_...` |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe | `pk_live_...` |
| `STRIPE_PRICE_ID_STARTER` | Price ID Stripe plan Starter | `price_...` |
| `STRIPE_PRICE_ID_PRO` | Price ID Stripe plan Pro | `price_...` |
| `STRIPE_PRICE_ID_BUSINESS` | Price ID Stripe plan Business | `price_...` |
| `SMTP_USERNAME` | Email envoi (mot de passe reset) | `no-reply@monapp.com` |
| `SMTP_PASSWORD` | Mot de passe SMTP | — |
| `SMTP_FROM_EMAIL` | Adresse "From" emails | `no-reply@monapp.com` |
| `ALLOWED_ORIGINS` | CORS origins supplémentaires (JSON) | `["https://monapp.com"]` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin JSON service account (dev) | `/root/.config/gcloud/...` |

---

## 12. Nginx

**Fichier**: `nginx.conf`  
Utilisé dans `Dockerfile.frontend.prod` pour la production.

| Location | Behaviour |
|----------|-----------|
| `/api/*` | Proxy → `localhost:8000` (sidecar Azure) |
| `/uploads/*` | Proxy → `localhost:8000` |
| `/health`, `/docs`, `/redoc`, `/openapi.json` | Proxy → `localhost:8000` |
| `/*` | `try_files` → SPA fallback `index.html` |

- Gzip activé pour CSS, JS, JSON, SVG
- Timeout proxy: 600s (pour génération vidéo longue)

---

## 13. Déploiement Azure

- **Registre**: Azure Container Registry (`laurenastudio.azurecr.io`)
- **Compute**: Azure Web App multi-container (via `docker-compose.azure.yml`)
- **Base de données**: Azure Database for PostgreSQL (accès VNet privé)
- **Secrets**: Azure App Settings (injectés comme variables d'environnement)
- **Images taguées**: par SHA commit Git (ex: `laurena-api:c36eee4`)

### Workflow CI/CD typique
```bash
# Build + push
docker build -t laurenastudio.azurecr.io/laurena-api:$(git rev-parse --short HEAD) -f backend/Dockerfile .
docker push laurenastudio.azurecr.io/laurena-api:$(git rev-parse --short HEAD)
# Mettre à jour docker-compose.azure.yml avec le nouveau tag
# Déployer via Azure CLI ou GitHub Actions
```

---

## 14. Restauration depuis ce snapshot

### Restaurer les images Docker
```bash
docker load -i laurena-api.tar
docker load -i laurena-frontend.tar
```

### Vérifier l'intégrité
```bash
sha256sum -c checksums.txt
```

### Relancer l'environnement local
```bash
# Copier le repo + ce dossier de snapshot
# Créer backend/.env avec les variables de la section 11
cd laurenastudio
docker compose up
```

### Réinstaller les dépendances Python
```bash
cd backend
pip install -r requirements.txt   # depuis requirements-backend.txt du snapshot
```

### Réinstaller les dépendances Node
```bash
npm install   # utilise package.json du snapshot
```

---

*Snapshot créé le 12/03/2026 — Laurena Studio v1.0.0*
