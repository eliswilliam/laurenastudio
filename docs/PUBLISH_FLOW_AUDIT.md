# Audit flux Criar site → URL personnalisée

Document de traçabilité (état après corrections). Légende : OK / ⚠️ / ❌.

## Variables d’environnement (aucune clé en dur dans le code métier)

| Variable | Usage |
|----------|--------|
| `GITHUB_TOKEN` | `app.core.config.settings` → `github_publish_service` |
| `GITHUB_OWNER` | idem |
| `GCP_PROJECT_ID` | secrets Actions + `cloud_run_lookup` |
| `GCP_SA_KEY` | secrets Actions (JSON/base64) |
| `CLOUDFLARE_TOKEN` | `dns_service._headers()` |
| `CLOUDFLARE_ZONE_ID` | API DNS Cloudflare |
| `ROOT_DOMAIN` | CNAME + URL finale `https://{slug}.{ROOT_DOMAIN}` |
| `GOOGLE_INDEXING_ENABLED` | Tâche ARQ différée → Indexing API (`google_indexing_service`) |
| `GOOGLE_INDEXING_DEFER_SECONDS` | Délai avant notification Google (défaut 5400 s) |
| `DATABASE_URL` | `Settings` → SQLAlchemy async |

`GCP_REGION`, `CLOUD_RUN_POLL_*` complètent le polling Run. Valeurs par défaut locales (ex. `DATABASE_URL`) existent pour le dev uniquement.

---

## Étape 1 — Frontend (prompt + slug)

| Point | Statut | Détail |
|-------|--------|--------|
| Prompt utilisateur | OK | `Textarea` `rascunho` → `POST /api/v1/sites/chat` |
| Champ slug | OK | `Input` `publishSlug`, filtre minuscules/chiffres/tirets |
| Validation slug | OK | `slugValid()` ; si backend exige slug (`GET /api/publish/config`), blocage si vide |
| Bouton Publicar pendant chargement | OK | `disabled={aPublicar \|\| !usuario?.id}` |

## Étape 2 — Appel publish (frontend → backend)

| Point | Statut | Détail |
|-------|--------|--------|
| POST `/api/publish` | OK | `publishApi.ts`, proxy Vite `/api` → FastAPI |
| Body | ⚠️ | `{ userId, projectId, files, slug? }` — **pas** de `prompt` dans publish : le brief est en BDD (`user_prompt`) après `/sites/generate` |
| Content-Type | OK | `application/json` |
| États loading / erreur | OK | `aPublicar`, `formatApiError`, message chat + bandeau |
| URL finale | OK | `siteUrl` + `success` / `deployOk` |

## Étape 3 — Endpoint FastAPI

| Point | Statut | Détail |
|-------|--------|--------|
| Router | OK | `main.py` : `include_router(publish_router, prefix="/api")` |
| CORS | OK | `ALLOWED_ORIGINS` + `localhost:8080` |
| `PublishRequest` | OK | `userId`, `projectId`, `files`, `slug` |
| `PublishResponse` | OK | `siteUrl`, `deployOk`, `success`, `actionsUrl` |
| Codes HTTP | ⚠️ | Erreurs amont GitHub/Run/DNS → **502** (pas 500) ; 400/403/409/404 comme prévu |

## Étape 4 — Slug en base

| Point | Statut | Détail |
|-------|--------|--------|
| `get_site_by_slug` | ⚠️ | Nom explicite non utilisé ; équivalent : `is_publish_slug_taken_by_other_project()` dans `site_publish_queries.py` avant déploiement si DNS actif |
| 409 si pris | OK | Autre projet avec même `publish_slug` |

## Étape 5 — Création BDD

| Point | Statut | Détail |
|-------|--------|--------|
| `deploying` / statut site | ⚠️ | Le modèle garde `status` = draft/generating/ready pour la **génération** ; la **publication** utilise `publication_status` = `publishing` → `live` / `failed` |
| `user_prompt` | OK | Rempli au `POST /sites/generate` |
| Déploiement `pending` | OK | `SiteDeployment` créé, puis statuts `github_pushed` → `cloud_run_ready` → `success`/`failed` |

## Étape 6 — LLM

| Point | Statut | Détail |
|-------|--------|--------|
| Fichiers `[{path, content}]` au publish | ❌ (volontaire) | Le flux actuel : **génération** produit HTML monolithique → `split_html_to_static_files` côté API publish — pas une liste LLM directe au moment du publish |

## Étape 7–8 — GitHub

| Point | Statut | Détail |
|-------|--------|--------|
| Repo `site-{user}-{timestamp}` | OK | `_repo_slug` |
| `auto_init`, sleep 2s | OK | `github_publish_service` |
| Un seul commit | OK | PyGithub `create_git_tree` + `create_git_commit` + `edit` ref (équivalent API Git Data) |
| Dockerfile + workflow | OK | Contenus injectés dans le même commit |
| `commit_sha` | OK | Retourné et stocké sur `SiteDeployment` |

## Étape 9 — Secrets GCP

| Point | Statut | Détail |
|-------|--------|--------|
| Clé publique Actions | OK | `_put_repo_secret` / API secrets |
| Ordre secrets avant commit workflow | OK | Secrets injectés **avant** le commit qui ajoute `deploy.yml` |

## Étape 10 — Cloud Run

| Point | Statut | Détail |
|-------|--------|--------|
| CI/CD | OK | Workflow utilisateur (hors repo app) |
| Polling URL | OK | `wait_for_cloud_run_url` → `cloud_run_url` en BDD |

## Étape 11 — Cloudflare

| Point | Statut | Détail |
|-------|--------|--------|
| CNAME proxied | OK | `create_subdomain` |
| Mise à jour si existe | OK | PATCH si enregistrement existant |

## Étape 12 — Mise à jour BDD

| Point | Statut | Détail |
|-------|--------|--------|
| Champs projet | OK | `github_repo_url`, `cloud_run_*`, `site_url`, `publish_slug`, `publication_status` |
| Déploiement | OK | `commit_sha`, `status`, `error_message` |

## Étape 13 — Retour frontend

| Point | Statut | Détail |
|-------|--------|--------|
| `siteUrl` + lien | OK | Bandeau + message chat |
| `success` | OK | Champ ajouté (miroir de `deployOk`) |

---

## Endpoints utiles

- `GET /api/publish/config` → `{ "requireSlug": true/false }` (aligné sur `dns_configured()`)

## Corrections appliquées lors de cet audit

- `publication_status` sur `laurena_site_projects` (migration 013).
- Helper `is_publish_slug_taken_by_other_project` + réponse `success`.
- `GET /api/publish/config` + frontend `requirePublishSlug`.
- `publication_status` exposé dans `GET /api/v1/sites/{id}`.
