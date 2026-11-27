# Accorde à github-deployer les rôles nécessaires pour
#   gcloud run deploy --source .
# (Artifact Registry repo cloud-run-source-deploy, Cloud Build, etc.)
#
# À lancer avec un compte ayant roles/resourcemanager.projectIamAdmin ou Owner :
#   .\scripts\gcp-grant-github-deployer-roles.ps1 -ProjectId "ace-matrix-475403-f7"
#
# Erreur typique sans ces rôles :
#   Permission 'artifactregistry.repositories.get' denied on ... cloud-run-source-deploy

param(
    [Parameter(Mandatory = $true)]
    [string] $ProjectId,
    [string] $DeployerEmail = ""
)

$ErrorActionPreference = "Stop"

if (-not $DeployerEmail) {
    $DeployerEmail = "github-deployer@${ProjectId}.iam.gserviceaccount.com"
}

$Member = "serviceAccount:$DeployerEmail"

Write-Host "Projet: $ProjectId"
Write-Host "Compte: $DeployerEmail"
Write-Host ""

$roles = @(
    "roles/artifactregistry.writer",
    "roles/run.admin",
    "roles/cloudbuild.builds.editor",
    "roles/storage.objectAdmin",
    "roles/logging.logWriter"
)

foreach ($role in $roles) {
    Write-Host "Ajout $role ..."
    gcloud projects add-iam-policy-binding $ProjectId --member=$Member --role=$role --quiet
}

Write-Host ""
Write-Host "Service Account User sur le compte d'exécution Cloud Run (Compute default)..."
$projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$runtimeSa = "${projectNumber}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding $runtimeSa `
    --member=$Member `
    --role="roles/iam.serviceAccountUser" `
    --project=$ProjectId

Write-Host ""
Write-Host "Service Account User sur Cloud Build (si le compte existe déjà)..."
$buildSa = "${projectNumber}@cloudbuild.gserviceaccount.com"
$exists = gcloud iam service-accounts describe $buildSa --project=$ProjectId 2>$null
if ($LASTEXITCODE -eq 0) {
    gcloud iam service-accounts add-iam-policy-binding $buildSa --member=$Member --role="roles/iam.serviceAccountUser" --project=$ProjectId --quiet
} else {
    Write-Host "(Compte $buildSa introuvable — ignoré ; souvent créé après la 1ère build Cloud Build.)"
}

Write-Host ""
Write-Host "OK. Relancez le workflow GitHub Actions sur le dépôt site-*."
