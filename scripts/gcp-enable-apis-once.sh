#!/usr/bin/env bash
# À lancer UNE FOIS avec un compte GCP ayant le droit d'activer les APIs
# (Owner ou roles/serviceusage.serviceUsageAdmin). Pas le compte github-deployer.
#
# Usage: export GCP_PROJECT_ID=your-project-id && ./scripts/gcp-enable-apis-once.sh

set -euo pipefail
: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"

gcloud config set project "${GCP_PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${GCP_PROJECT_ID}"

echo "OK — APIs activées pour ${GCP_PROJECT_ID}"
