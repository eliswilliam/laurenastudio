# ============================================================
#  Backup Script — laurenafoncionel 12/03/26
#  Sauvegarde images Docker + requirements + sources clés
#  Récupération: voir section RESTORE en bas de ce fichier
# ============================================================

$BackupName  = "laurenafoncionel12-03-26"
$BackupDir   = Join-Path (Split-Path $PSScriptRoot -Parent) $BackupName
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  BACKUP LAURENA STUDIO — 12/03/2026" -ForegroundColor Cyan
Write-Host "  Destination : $BackupDir" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Créer le dossier de sauvegarde ──────────────────────
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "[OK] Dossier créé : $BackupDir" -ForegroundColor Green
} else {
    Write-Host "[INFO] Dossier existant, mise à jour du contenu..." -ForegroundColor Yellow
}

# ── 2. Build des images Docker ─────────────────────────────
Write-Host ""
Write-Host "[1/5] Build image API (backend)..." -ForegroundColor Yellow
docker build -t "${BackupName}/api:latest" -f "$ProjectRoot\backend\Dockerfile" "$ProjectRoot"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERREUR] Build API échoué" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Image API buildée" -ForegroundColor Green

Write-Host ""
Write-Host "[2/5] Build image Frontend (prod)..." -ForegroundColor Yellow
docker build -t "${BackupName}/frontend:latest" -f "$ProjectRoot\Dockerfile.frontend.prod" "$ProjectRoot"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERREUR] Build Frontend échoué" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Image Frontend buildée" -ForegroundColor Green

# ── 3. Sauvegarder les images en .tar ──────────────────────
Write-Host ""
Write-Host "[3/5] Sauvegarde images Docker en .tar..." -ForegroundColor Yellow

$ApiTar      = Join-Path $BackupDir "laurena-api.tar"
$FrontendTar = Join-Path $BackupDir "laurena-frontend.tar"

docker save "${BackupName}/api:latest" -o $ApiTar
if ($LASTEXITCODE -ne 0) { Write-Host "[ERREUR] Save image API échoué" -ForegroundColor Red; exit 1 }
Write-Host "[OK] API sauvegardée → $ApiTar" -ForegroundColor Green

docker save "${BackupName}/frontend:latest" -o $FrontendTar
if ($LASTEXITCODE -ne 0) { Write-Host "[ERREUR] Save image Frontend échoué" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Frontend sauvegardé → $FrontendTar" -ForegroundColor Green

# ── 4. Copier les fichiers de dépendances ──────────────────
Write-Host ""
Write-Host "[4/5] Copie des fichiers de dépendances..." -ForegroundColor Yellow

$FilesToCopy = @(
    @{ Src = "backend\requirements.txt";     Dst = "requirements-backend.txt" },
    @{ Src = "package.json";                 Dst = "package.json" },
    @{ Src = "bun.lockb";                    Dst = "bun.lockb" },
    @{ Src = "backend\Dockerfile";           Dst = "Dockerfile.backend" },
    @{ Src = "Dockerfile.frontend";          Dst = "Dockerfile.frontend.dev" },
    @{ Src = "Dockerfile.frontend.prod";     Dst = "Dockerfile.frontend.prod" },
    @{ Src = "docker-compose.yml";           Dst = "docker-compose.yml" },
    @{ Src = "docker-compose.azure.yml";     Dst = "docker-compose.azure.yml" },
    @{ Src = "nginx.conf";                   Dst = "nginx.conf" }
)

foreach ($f in $FilesToCopy) {
    $src = Join-Path $ProjectRoot $f.Src
    $dst = Join-Path $BackupDir  $f.Dst
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  [OK] $($f.Src) → $($f.Dst)" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] $($f.Src) introuvable" -ForegroundColor DarkYellow
    }
}

# ── 5. Générer les checksums SHA256 ────────────────────────
Write-Host ""
Write-Host "[5/5] Génération des checksums SHA256..." -ForegroundColor Yellow

$ChecksumFile = Join-Path $BackupDir "checksums.txt"
$checksumLines = @("# Checksums SHA256 - $BackupName - $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "")

foreach ($tarFile in @($ApiTar, $FrontendTar)) {
    if (Test-Path $tarFile) {
        $hash = (Get-FileHash $tarFile -Algorithm SHA256).Hash
        $fname = Split-Path $tarFile -Leaf
        $checksumLines += "$hash  $fname"
        Write-Host "  [OK] $fname → $hash" -ForegroundColor Green
    }
}

$checksumLines | Out-File $ChecksumFile -Encoding UTF8
Write-Host "[OK] Checksums → $ChecksumFile" -ForegroundColor Green

# ── Écrire le fichier RESTORE.md ───────────────────────────
$RestoreContent = @"
# RESTORE — $BackupName

## Restaurer les images Docker
``````powershell
docker load -i laurena-api.tar
docker load -i laurena-frontend.tar
``````

## Vérifier les checksums
``````powershell
# Comparer manuellement avec checksums.txt
Get-FileHash laurena-api.tar -Algorithm SHA256
Get-FileHash laurena-frontend.tar -Algorithm SHA256
``````

## Relancer l'environnement local
``````powershell
# 1. Copier le code source (si perdu, cloner le repo)
# 2. Créer backend/.env avec les variables d'environnement
# 3. Lancer avec les images sauvegardées :
docker tag ${BackupName}/api:latest laurenastudio-api:restored
docker tag ${BackupName}/frontend:latest laurenastudio-frontend:restored
cd <dossier-projet>
docker compose up
``````

## Réinstaller les dépendances à la main
``````powershell
# Python
pip install -r requirements-backend.txt

# Node
npm install    # utilise package.json de ce dossier
``````

## Images disponibles
- ``${BackupName}/api:latest``    → API FastAPI Python 3.11
- ``${BackupName}/frontend:latest`` → Nginx + React (production)

## Créé le
$(Get-Date -Format 'dd/MM/yyyy HH:mm')
"@

$RestoreContent | Out-File (Join-Path $BackupDir "RESTORE.md") -Encoding UTF8

# ── Résumé final ───────────────────────────────────────────
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  BACKUP TERMINÉ AVEC SUCCÈS !" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Dossier : $BackupDir" -ForegroundColor White
Write-Host ""
Write-Host "  Fichiers créés :" -ForegroundColor White
Get-ChildItem $BackupDir | ForEach-Object {
    $size = if ($_.Length -gt 1MB) { "{0:N0} MB" -f ($_.Length / 1MB) }
             elseif ($_.Length -gt 1KB) { "{0:N0} KB" -f ($_.Length / 1KB) }
             else { "$($_.Length) B" }
    Write-Host ("  - {0,-40} {1}" -f $_.Name, $size) -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Pour restaurer : ouvrir RESTORE.md dans $BackupDir" -ForegroundColor Cyan
Write-Host ""
