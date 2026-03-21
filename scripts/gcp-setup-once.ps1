# Configuration GCP en local (UNE FOIS) : connexion SDK + activation des APIs.
# Exécuter avec PowerShell depuis la racine du dépôt :
#   .\scripts\gcp-setup-once.ps1 -ProjectId "votre-project-id"
#
# Prérequis : Google Cloud SDK installé (https://cloud.google.com/sdk/docs/install)
# Utilisez un compte Google avec rôle Owner ou Service Usage Admin sur le projet.
# Ne pas utiliser le JSON github-deployer pour cette étape (droits insuffisants pour enable).

param(
    [Parameter(Mandatory = $true)]
    [string] $ProjectId
)

$ErrorActionPreference = "Stop"

Write-Host "Ouverture du navigateur pour gcloud auth login..."
gcloud auth login
gcloud auth application-default login

gcloud config set project $ProjectId

Write-Host "Activation des APIs (nécessite Owner / Service Usage Admin)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com `
    --project=$ProjectId

Write-Host "Terminé. Les workflows GitHub n’ont plus besoin de « gcloud services enable »."
Write-Host "Si votre organisation exige un tag « environment » sur le projet, voir :"
Write-Host "https://cloud.google.com/resource-manager/docs/creating-managing-projects#designate_project_environments_with_tags"
