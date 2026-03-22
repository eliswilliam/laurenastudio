FROM python:3.11-slim

WORKDIR /app

# System deps for asyncpg / bcrypt / cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer-cached separately from source)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source (app/, alembic/, alembic.ini, scripts/)
COPY backend/ .

RUN sed -i 's/\r$//' scripts/docker-entrypoint-api-azure.sh && chmod +x scripts/docker-entrypoint-api-azure.sh

# Expose FastAPI port
EXPOSE 8000

# Health check endpoint (used by nginx/container orchestration)
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

# Run migrations then start the server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
