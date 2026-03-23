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
