# Générateur de sites — Criar site (historique d’implémentation)

Ce document résume l’architecture du **site builder** (chat Laurena + génération HTML via Gemini),
en lien avec le frontend `/criar-site` et l’API FastAPI.

---

## Vue d’ensemble

| Couche | Fichiers / emplacement |
|--------|-------------------------|
| **DB** | `laurena_site_projects`, `laurena_site_prompts`, `laurena_generated_sites` |
| **Migrations** | `009_…` (historique) + **`010_laurena_site_builder_tables.py`** (tables réelles ; évite le conflit avec une ancienne `site_projects` liée à `users.owner_id`) |
| **IA chat + structure** | `backend/app/services/site_ai_service.py` |
| **HTML (Jinja)** | `backend/app/services/site_generator.py` |
| **Routes REST** | `backend/app/routes/sites.py` |
| **Schémas Pydantic** | `backend/app/schemas/site.py` |
| **Modèles ORM** | `backend/app/models/site_project.py` |
| **Frontend** | `src/pages/CriarSite.tsx` → `POST /api/v1/sites/*` |

---

## Base de données (3 nouvelles tables)

| Table | Rôle | Relations |
|-------|------|-----------|
| `laurena_site_projects` | Un projet = un site | `workspace_id` → `workspaces` |
| `laurena_site_prompts` | Messages du chat | `project_id` → `laurena_site_projects` |
| `laurena_generated_sites` | JSON + HTML | `project_id` → `laurena_site_projects` (1:1) |

---

## Module IA (`site_ai_service.py`)

- **`generate_chat_reply()`** — Gemini (`gemini-2.5-flash-preview-05-20`), mode conversationnel, persona « Laurena », réponses courtes, même langue que l’utilisateur.
- **`generate_site_structure()`** — Même modèle avec system prompt imposant un **JSON strict** : `site_name`, `description`, `primary_color`, `font`, `sections[]` (types hero, features, faq, etc.). Validation JSON côté Python.

Client Gemini : aligné sur le reste du backend (`google-genai`, `_get_client()` / clé Vertex comme le marketing).

---

## Générateur HTML (`site_generator.py`)

- Template **Jinja2** embarqué → page HTML/CSS responsive (hero, features, pricing, FAQ, contact, CTA, footer, …).
- **`save_site()`** → `uploads/sites/<project_id>/index.html` + `structure.json`.
- **`create_zip()`** — ZIP en mémoire pour le téléchargement.

> **Note Jinja** : utilisation de `section.get("items", [])` et non `section.items` (sinon collision avec la méthode `.items()` des dicts Python).

---

## Routes FastAPI (`/api/v1/sites/…`)

| Méthode | Endpoint | Rôle |
|---------|----------|------|
| `POST` | `/sites/chat` | Chat + création du `project_id` au premier message |
| `POST` | `/sites/generate` | Génération du site depuis le briefing (messages user agrégés) |
| `GET` | `/sites/{project_id}` | Statut, preview URL, erreurs |
| `GET` | `/sites/{project_id}/download` | Téléchargement ZIP |
| `GET` | `/sites/` | Liste des projets du workspace |

Accès : `verify_active_subscription` + `check_and_increment_usage` (quota type `text`).

---

## Frontend (`CriarSite.tsx`)

- Appels **`POST /sites/chat`** avec historique + `project_id` après la première réponse.
- Bouton **« Gerar site »** → **`POST /sites/generate`**.
- Liens **Preview** (`/uploads/sites/.../index.html`) et **Download** (`/sites/{id}/download`).
- Gestion d’erreurs affichée à l’écran.

Client HTTP : `src/lib/api.ts` (`baseURL: /api/v1`, Bearer JWT).

---

## Publication (`POST /api/publish`) — GitHub Actions vs Cloudflare

Le **workflow GitHub** déploie le contenu vers **Cloud Run** (build + push image, etc.). Ce n’est **pas** lui qui crée le sous-domaine.

Après que l’API a obtenu l’URL Cloud Run (`wait_for_cloud_run_url`), **le même handler FastAPI** peut appeler **Cloudflare** (`dns_service.create_subdomain`) pour un CNAME proxifié `slug` → hostname Cloud Run, si `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONE_ID` et `ROOT_DOMAIN` sont définis (`dns_configured()`). Sinon, `siteUrl` dans la réponse reste l’URL **`.run.app`**.

- `GET /api/publish/config` → `{ requireSlug: true }` quand Cloudflare est configuré (le front exige alors un slug).
- La réponse inclut `dnsApplied`, `siteUrl`, `cloudRun` pour distinguer URL canonique vs URL directe Cloud Run.

### Automatisation sous-domaine (GCP + Cloudflare)

Après le déploiement Cloud Run, `POST /api/publish` enchaîne :

1. **Domain mapping** via l’API `domains.cloudrun.com/v1` sur l’**hôte régional** `https://{GCP_REGION}-run.googleapis.com/...` (pas `run.googleapis.com` seul — le POST échoue en 404). Même `GCP_SA_KEY` / projet que le polling Run.
2. Lecture des **`resourceRecords`** renvoyés par Google (A / AAAA / CNAME / TXT selon le cas).
3. **Mise à jour Cloudflare** : suppression des anciens enregistrements pour ce sous-domaine, puis création des enregistrements exigés par Google avec **`proxied: false` (DNS only, nuage gris)**. Le mode **proxied** vers `ghs.googlehosted.com` / IPs Google provoque souvent l’**erreur Cloudflare 525** (échec du TLS entre Cloudflare et l’origine Google).

Variables utiles : `GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS`, `GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS`.

En cas d’échec (IAM, quotas), le message d’erreur HTTP indique de vérifier **Cloud Run → Domain mappings** et les rôles `run.domainmappings.*` (souvent couverts par `roles/run.admin` sur le projet pour le compte de la clé `GCP_SA_KEY`).

**Diagnostic (réponse API `GET …/domainmappings/{fqdn}`)** :

- Si `reason: PermissionDenied` + *« Caller is not authorized to administer the domain »* : le **caller** est le `client_email` de **`GCP_SA_KEY`**, pas ton utilisateur `gcloud`. Il doit être **propriétaire** de la propriété domaine dans Search Console (domaine racine ou parent du sous-domaine).
- **Cas observé** : après ajout du propriétaire dans Search Console, un mapping **déjà créé** peut **garder** `PermissionDenied` (même `lastTransitionTime` ancien) jusqu’à **suppression + recréation** du mapping. Un `DELETE` puis nouveau `POST` (ou suppression dans **Cloud Run → Domain mappings** puis nouvelle publication) a fait passer l’API en `DomainRoutable` + `resourceRecords` (ex. CNAME vers `ghs.googlehosted.com`).
- Ensuite le message *« You must configure your DNS records for certificate issuance »* signifie qu’il faut appliquer ces enregistrements chez le DNS (ici l’automation Cloudflare après `POST /api/publish`).

**Erreur 525** sur `https://slug.domaine` : passer l’enregistrement concerné en **DNS only** dans Cloudflare (ou republier après mise à jour de l’API). Ne pas utiliser le proxy orange pour les cibles Google du domain mapping.

---

## Tests

- **Frontend** : `npm run test` — `CriarSite.test.tsx` (mock API), `criarSiteChat.test.ts`.
- **Backend — contrat publish + mapping (Docker)** :
  ```bash
  docker compose exec api python scripts/verify_publish_automation.py
  ```
  Vérifie : `PublishResponse` (`siteUrl`, `dnsApplied`), forme `https://{slug}.{ROOT_DOMAIN}`, `dns_configured()`, puis `unittest test_domain_mapping_automation` + `pytest test_dns_google_names.py`.
- **Mapping + Cloudflare seulement** (sans GitHub) : `docker compose exec api python scripts/test_mapping_zar.py` — slug par défaut `zar`, service Run = dernier listé ou `TEST_CLOUD_RUN_SERVICE_NAME`. Option : `TEST_MAPPING_POLL_MAX_SECONDS=1800` si le certificat Google dépasse 15 min.
- **Config publique** : `GET /api/publish/config` → `{ "requireSlug": true }` quand Cloudflare + `ROOT_DOMAIN` sont définis (le front exige alors le slug).

### Surveiller un publish long (E2E / Criar site)

- Une seule requête `POST /api/publish` reste **ouverte** jusqu’à la fin (GitHub → Actions → Cloud Run → domain mapping → Cloudflare) : **15–40 minutes** possibles. Le terminal qui lance le script peut sembler « bloqué » ou l’outil peut **timeout** : c’est normal côté HTTP.
- **Suivi réel** : dans un **second** terminal, `docker compose logs -f api` et repérer les lignes préfixées **`[publish]`** (`GitHub push OK`, `polling Cloud Run`, `still waiting for Cloud Run`, `domain mapping + Cloudflare`, `waiting for … Ready`, `done site_url=…`).
- **Attention** : avec `uvicorn --reload` (compose par défaut), **enregistrer un fichier** sous `./backend` redémarre l’API et **coupe** une publication en cours. Éviter les sauvegardes pendant un test long, ou lancer l’API sans `--reload` pour les E2E.
- **Erreur `oauth2.googleapis.com` / `SSLEOFError` / `Max retries`** : le backend rafraîchit un jeton OAuth pour appeler les APIs GCP. Coupure TLS souvent **transitoire** (Docker sous Windows, VPN, proxy, réseau instable). Le code **réessaie** plusieurs fois le refresh ; si l’erreur continue : heure système correcte, désactiver l’inspection HTTPS d’un antivirus/proxy, ou réessayer plus tard.

---

## Docker — reconstruire et tester

Depuis la racine du dépôt :

```bash
docker compose build --no-cache api frontend
docker compose up -d
```

Puis :

- API : <http://localhost:8000/health> et <http://localhost:8000/docs> (tag **Site Builder**).
- Frontend : <http://localhost:8080/criar-site> (compte + plan actif requis).
- Migrations : `alembic upgrade head` au démarrage du conteneur `api`.

**Secrets** : `GOOGLE_CLOUD_API_KEY` (et config Vertex existante) dans `backend/.env` pour les appels Gemini.

**Modèle texte** : variable optionnelle `GEMINI_TEXT_MODEL` (défaut : `gemini-2.5-flash` dans `app/core/config.py`). Si l’API Google renvoie une erreur de modèle, définir un modèle valide pour votre projet/région.

---

## Chronologie (résumé)

1. Modèles SQLAlchemy + migration `009`.
2. Service IA + générateur Jinja + stockage local `uploads/sites/`.
3. Router FastAPI enregistré dans `app/main.py`.
4. Dépendance **Jinja2** dans `backend/requirements.txt`.
5. Frontend branché sur l’API réelle.

---

---

## Publication GitHub (`POST /api/publish`)

Après génération, le frontend envoie **`userId`**, **`projectId`** et un tableau **`files`** vide : le backend lit `uploads/sites/<project_id>/index.html`, découpe en `index.html` + `styles.css` + `app.js`, crée un dépôt `site-{userId}-{timestamp}`, un **commit unique** (API Git Data), ajoute `Dockerfile` (nginx:8080), `.dockerignore`, `.github/workflows/deploy.yml` (Cloud Run), puis injecte les secrets Actions **GCP_SA_KEY** et **GCP_PROJECT_ID** (chiffrement LibSodium / PyNaCl — équivalent serveur de `libsodium-wrappers`).

| Variable `.env` | Rôle |
|-----------------|------|
| `GITHUB_TOKEN` | PAT : scopes **repo**, **workflow** ; dépôts `site-*` créés en **privé** |
| `GITHUB_OWNER` | Compte ou org GitHub cible |
| `GCP_PROJECT_ID` | Projet Google Cloud |
| `GCP_SA_KEY` | JSON complet du compte de service (ou base64 du JSON) |
| `GCP_REGION` | Région `gcloud run deploy` (défaut `us-central1`) |
| `GOOGLE_INDEXING_ENABLED` | `true` / `false` — notifie Google Indexing API après publication sous-domaine (défaut `true`) |
| `GOOGLE_INDEXING_DEFER_SECONDS` | Secondes d’attente après **enqueue** du publish avant l’appel Indexing (défaut **5400** = 1 h 30) |

Paquets Python : `PyGithub`, `PyNaCl`, `google-api-python-client` (Indexing API — voir `backend/requirements.txt`). Pas de `@octokit/rest` côté API : le backend est Python.

### Google Indexing API (après **Publicar** avec slug + DNS)

Si **Cloudflare** + **`ROOT_DOMAIN`** sont configurés et que l’utilisateur publie avec un **slug**, le backend enqueue une tâche ARQ **`arq_google_index_site`** avec un délai **`GOOGLE_INDEXING_DEFER_SECONDS`** (souvent 1 h 30 après le clic, le temps que le site et le DNS soient stables). Au moment d’exécution, l’URL **`https://{slug}.{ROOT_DOMAIN}/`** est envoyée à l’[Indexing API v3](https://developers.google.com/search/apis/indexing-api/v3/using-api) (`URL_UPDATED`), avec le même **`GCP_SA_KEY`** (ou **`GOOGLE_CREDENTIALS_JSON`**) que pour Cloud Run.

**Prérequis** : dans Google Cloud Console, activer l’API **Indexing API** sur le projet ; dans Search Console, le **`client_email`** du compte de service doit être **propriétaire** de la propriété couvrant **`*.ROOT_DOMAIN`** (souvent une propriété **Domaine** sur la racine). Sinon **403** (déjà journalisé). Désactiver : `GOOGLE_INDEXING_ENABLED=false`. Après `pip install -r requirements.txt`, **redémarrer l’API FastAPI et le processus worker ARQ** pour charger `google-api-python-client` et enregistrer la nouvelle fonction. Modèle : `backend/.env.example`.

**Implémentation** : les secrets GitHub Actions (`GCP_SA_KEY`, `GCP_PROJECT_ID`) sont créés **avant** le commit qui ajoute `deploy.yml`. Le workflow **n’appelle plus** `gcloud services enable` : cette commande exige le rôle **Service Usage Admin** (`roles/serviceusage.serviceUsageAdmin`) ou **Owner**, que le compte `github-deployer` n’a en général pas — d’où les erreurs `AUTH_PERMISSION_DENIED` sur `artifactregistry.googleapis.com` / `cloudbuild.googleapis.com` / `run.googleapis.com`.

### Erreur GitHub Actions : `gcloud.services.enable` / `AUTH_PERMISSION_DENIED`

Si les logs montrent encore **`gcloud services enable`** (Run / Cloud Build / Artifact Registry), le dépôt GitHub contient **l’ancien** `deploy.yml` (avant la correction). Ce n’est **pas** résolu par un « login » du compte `github-deployer` : il faut soit **republier** un site (nouveau dépôt privé avec le workflow généré à jour), soit **remplacer** le fichier [docs/deploy-cloud-run-workflow.yml](deploy-cloud-run-workflow.yml) dans `.github/workflows/deploy.yml` sur le dépôt concerné (adapter `REGION_PLACEHOLDER`).

### Configuration GCP **une fois** (compte Owner ou utilisateur avec `roles/serviceusage.serviceUsageAdmin`)

Dans Cloud Shell ou avec `gcloud` connecté à votre compte utilisateur (pas le JSON du deployer) :

```bash
gcloud config set project VOTRE_PROJECT_ID

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=VOTRE_PROJECT_ID
```

Sous **Windows**, vous pouvez utiliser le script interactif (navigateur pour `gcloud auth login`) : [scripts/gcp-setup-once.ps1](../scripts/gcp-setup-once.ps1).

Si votre organisation impose un **tag `environment`** sur le projet, ajoutez-le selon [la doc Google](https://cloud.google.com/resource-manager/docs/creating-managing-projects#designate_project_environments_with_tags) (sinon `gcloud` peut afficher un avertissement ; l’échec venait surtout de `services enable` sans droits).

Le workflow exécute ensuite uniquement `gcloud run deploy --source .` avec `project_id` dans l’action `auth`. `Dockerfile` : nginx sur **8080** (`conf.d` et `http.d`).

**Test Docker (texte)** : avec la stack `docker compose up`,  
`docker compose exec api python test_publish_cloud.py` enchaîne login/plan → chat → generate → `POST /api/publish`. Variables obligatoires dans `backend/.env` : `GITHUB_TOKEN`, **`GITHUB_OWNER`** (non vide), `GCP_PROJECT_ID`, `GCP_SA_KEY`.

**Réponse `POST /api/publish`** : `{ "github", "siteUrl", "deployOk", "actionsUrl", "cloudRun": null }`. `siteUrl` est l’URL publique canonique : sous-domaine **`https://{slug}.{ROOT_DOMAIN}`** si **Cloudflare** est configuré (`CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONE_ID`, `ROOT_DOMAIN`) et que le body inclut **`slug`** + **`projectId`** ; sinon l’URL **Cloud Run** directe tant que le DNS personnalisé n’est pas actif. `cloudRun` n’est plus exposé (toujours `null`). Après le push, l’API interroge l’API **Run v2** jusqu’à `CLOUD_RUN_POLL_MAX_SECONDS` (défaut **1200** s). Conflit de slug réservé : **409** `Ce nom est déjà utilisé` (colonne `publish_slug` sur `laurena_site_projects`, migration **011**).

**Cloudflare** (optionnel) : enregistrement **CNAME** proxifié du sous-domaine vers le hostname Cloud Run (sans `https://`). Variables : `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONE_ID`, `ROOT_DOMAIN` ; `CLOUDFLARE_ACCOUNT_ID` est réservé (non requis pour l’API DNS par zone).

**Persistance (migration 012)** : `laurena_site_projects` stocke le dernier état publié (`github_repo_url`, `cloud_run_url`, `cloud_run_service_name`, `site_url`, `user_prompt` rempli à la génération). Table **`laurena_site_deployments`** : une ligne par tentative de publication (`status` : `pending` → `github_pushed` → `cloud_run_ready` → `success` ou `failed`, `commit_sha`, `error_message`). `GET /api/v1/sites/{project_id}` renvoie ces champs + l’historique des déploiements.

**IAM GCP recommandé** pour `gcloud run deploy --source .` (compte type `github-deployer@…`) : au minimum sur le projet — **`roles/artifactregistry.writer`** (obligatoire pour le dépôt `cloud-run-source-deploy` — sans cela : `artifactregistry.repositories.get` / `PERMISSION_DENIED`), `roles/run.admin`, `roles/cloudbuild.builds.editor`, `roles/storage.objectAdmin` ; **Service Account User** sur `PROJECT_NUMBER-compute@developer.gserviceaccount.com`. Script : [scripts/gcp-grant-github-deployer-roles.ps1](../scripts/gcp-grant-github-deployer-roles.ps1).

*Dernière mise à jour du document : mars 2026.*
