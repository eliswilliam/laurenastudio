# Migrations PostgreSQL sur Azure

La base **Flexible Server** est en réseau **privé** (VNet). Depuis ton PC, `alembic` ne peut en général **pas** s’y connecter, même avec la bonne `DATABASE_URL`.

## Option A — Automatique (recommandé)

L’image combinée exécute **`alembic upgrade head`** au démarrage du conteneur, puis lance nginx / uvicorn / worker.

1. **Pousser sur `main`** pour déclencher le déploiement GitHub Actions vers App Service.
2. Vérifier dans les **journaux** du conteneur (Log stream) que la migration passe (pas d’erreur après `alembic upgrade head`).
3. **Ne pas** définir `SKIP_ALEMBIC=1` dans les paramètres d’application Azure en production (cette variable sert uniquement aux tests CI / smoke tests sans base).

## Option B — Manuel (une fois, sans attendre un nouveau build)

1. Portail Azure → **App Service** (`studiolaurena`) → **SSH** (ou console du conteneur Linux).
2. Dans le shell :

   ```sh
   cd /app
   python -m alembic upgrade head
   ```

   `DATABASE_URL` est déjà fournie par la configuration de l’application.

## Variables utiles

| Variable            | Rôle |
|---------------------|------|
| `DATABASE_URL`      | Définie dans App Service ; utilisée par l’app et Alembic. |
| `SKIP_ALEMBIC=1`    | Désactive les migrations au démarrage (tests CI uniquement). |

## En local (développement)

Avec une base accessible (Docker local, tunnel, etc.), depuis le dossier `backend` :

```powershell
cd backend
python -m alembic upgrade head
```

Configurer `DATABASE_URL` dans `backend/.env` ou l’environnement.

## Autres méthodes de vérification

| Méthode | Comment |
|--------|---------|
| **GitHub Actions** | Repo → **Actions** → dernier workflow sur `main` : job **Deploy** vert = image poussée et redémarrage déclenché. |
| **Azure CLI (logs)** | `az webapp log tail -g studio -n studiolaurena` — cherche les lignes au démarrage du conteneur (alembic / erreurs). Active d’abord les logs App Service si besoin : `az webapp log config -g studio -n studiolaurena --application-logging filesystem --level information`. |
| **SSH dans le conteneur** | Même shell que l’option B : `cd /app` puis `python -m alembic current` — affiche la **révision Alembic** appliquée (doit correspondre à `head` du repo). |
| **Portail** | App Service → **Monitoring** → **Log stream** ; ou **Diagnose and solve** → problèmes de démarrage / logs. |
| **Test applicatif** | Si une route ou l’UI échoue avec une erreur SQL du type « colonne inexistante », la migration n’est peut‑être pas passée ; l’inverse ne prouve pas tout seul que tout est à jour. |

La vérification la plus directe côté base, **sans** Log stream : **`python -m alembic current`** dans le conteneur (le processus voit `DATABASE_URL` comme au démarrage).
