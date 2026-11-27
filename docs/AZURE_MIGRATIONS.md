# PostgreSQL Migrations on Azure

The **Flexible Server** database runs inside a **private network** (VNet). From a local machine, `alembic` generally **cannot** connect to it directly, even with the right `DATABASE_URL`.

## Option A — Automatic (Recommended)

The combined container image runs **`alembic upgrade head`** automatically on container startup before launching nginx / uvicorn / worker.

1. **Push to `main`** to trigger the GitHub Actions deployment to App Service.
2. Check the container **Log stream** to verify that the migration succeeds (no errors after `alembic upgrade head`).
3. **Do not** set `SKIP_ALEMBIC=1` in production Azure Application Settings (this variable is only intended for CI / smoke tests without a database).

## Option B — Manual (One-off, without waiting for a new build)

1. Azure Portal → **App Service** (`studiolaurena`) → **SSH** (or Linux container console).
2. In the shell:

   ```sh
   cd /app
   python -m alembic upgrade head
   ```

   `DATABASE_URL` is already provided by the application environment configuration.

## Useful Variables

| Variable       | Role |
|----------------|------|
| `DATABASE_URL` | Set in App Service; used by both the app and Alembic. |
| `SKIP_ALEMBIC=1` | Disables migrations at startup (CI tests only). |

## Local Development

With an accessible local database (local Docker, tunnel, etc.), from the `backend` folder:

```powershell
cd backend
python -m alembic upgrade head
```

Configure `DATABASE_URL` in `backend/.env` or your environment.

## Additional Verification Methods

| Method | How |
|--------|-----|
| **GitHub Actions** | Repo → **Actions** → latest workflow on `main`: green **Deploy** job = image pushed and container restart triggered. |
| **Azure CLI (logs)** | `az webapp log tail -g studio -n studiolaurena` — inspect container startup lines (alembic / errors). Enable App Service logs first if needed: `az webapp log config -g studio -n studiolaurena --application-logging filesystem --level information`. |
| **Container SSH** | Same shell as Option B: `cd /app` then `python -m alembic current` — displays the currently applied **Alembic revision** (should match the repo `head`). |
| **Azure Portal** | App Service → **Monitoring** → **Log stream**; or **Diagnose and solve** → startup issues / logs. |
| **Application test** | If a route or UI fails with an SQL error such as "column does not exist", the migration may not have run. |

The most direct database verification **without** Log stream is running **`python -m alembic current`** inside the container (the process sees the same `DATABASE_URL` as at startup).
