# predeploy-azure.ps1
# Build/test exactly the same images used by Azure deploy (API + frontend prod).

param(
    [string]$Registry = "laurenastudio.azurecr.io",
    [string]$ApiImage = "laurena-api",
    [string]$FrontendImage = "laurena-frontend",
    [string]$Tag = ""
)

$ErrorActionPreference = "Stop"

if (-not $Tag) {
    $Tag = (git rev-parse --short HEAD).Trim()
}

Write-Host "" 
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " Azure Predeploy Check" -ForegroundColor Cyan
Write-Host " Registry : $Registry" -ForegroundColor Cyan
Write-Host " Tag      : $Tag" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1) Build images (same Dockerfiles as backup/prod)
Write-Host "[1/6] Building API image..." -ForegroundColor Yellow
docker build --tag "$ApiImage`:$Tag" --tag "$ApiImage`:latest" --file backend/Dockerfile .
Write-Host "[OK] API image built" -ForegroundColor Green

Write-Host "[2/6] Building Frontend prod image..." -ForegroundColor Yellow
docker build --tag "$FrontendImage`:$Tag" --tag "$FrontendImage`:latest" --file Dockerfile.frontend.prod .
Write-Host "[OK] Frontend image built" -ForegroundColor Green

# 2) Smoke run containers (shared user-defined network + DNS alias "api" so nginx can proxy)
Write-Host "[3/6] Starting API container for smoke test..." -ForegroundColor Yellow
try { docker rm -f predeploy-test-api predeploy-test-frontend 2>&1 | Out-Null } catch {}
docker network rm predeploy-ci-net 2>&1 | Out-Null
docker network create predeploy-ci-net | Out-Null

docker run --detach --name predeploy-test-api --network predeploy-ci-net --network-alias api --publish 18000:8000 "$ApiImage`:$Tag" sh -c "uvicorn app.main:app --host 0.0.0.0 --port 8000" | Out-Null

Write-Host "[4/6] Starting Frontend container for smoke test..." -ForegroundColor Yellow
docker run --detach --name predeploy-test-frontend --network predeploy-ci-net --publish 18080:8080 "$FrontendImage`:$Tag" | Out-Null

# 3) Health checks
Write-Host "[5/6] Health checks..." -ForegroundColor Yellow

$apiOk = $false
for ($i = 1; $i -le 12; $i++) {
    Start-Sleep -Seconds 3
    try {
        $apiRes = Invoke-WebRequest -Uri "http://localhost:18000/health" -UseBasicParsing -TimeoutSec 10
        if ($apiRes.StatusCode -ge 200 -and $apiRes.StatusCode -lt 400) {
            $apiOk = $true
            break
        }
    } catch {}
}

$feOk = $false
for ($i = 1; $i -le 12; $i++) {
    Start-Sleep -Seconds 2
    try {
        $feRes = Invoke-WebRequest -Uri "http://localhost:18080/" -UseBasicParsing -TimeoutSec 10
        if ($feRes.StatusCode -ge 200 -and $feRes.StatusCode -lt 400) {
            $feOk = $true
            break
        }
    } catch {}
}

if (-not $apiOk) {
    Write-Host "[ERROR] API health check failed" -ForegroundColor Red
    docker logs predeploy-test-api
    exit 1
}

if (-not $feOk) {
    Write-Host "[ERROR] Frontend health check failed" -ForegroundColor Red
    docker logs predeploy-test-frontend
    exit 1
}

Write-Host "[OK] Smoke tests passed" -ForegroundColor Green

# 4) Tag for ACR (optional push done by GitHub Actions)
Write-Host "[6/6] Suggested ACR tags:" -ForegroundColor Yellow
Write-Host "docker tag $ApiImage`:$Tag $Registry/$ApiImage`:$Tag"
Write-Host "docker tag $FrontendImage`:$Tag $Registry/$FrontendImage`:$Tag"
Write-Host "docker tag $ApiImage`:$Tag $Registry/$ApiImage`:latest"
Write-Host "docker tag $FrontendImage`:$Tag $Registry/$FrontendImage`:latest"

# Cleanup test containers and network
try { docker rm -f predeploy-test-api predeploy-test-frontend 2>&1 | Out-Null } catch {}
docker network rm predeploy-ci-net 2>&1 | Out-Null

Write-Host ""
Write-Host "Predeploy check done successfully." -ForegroundColor Green
