# start.ps1 — Kill local processes then rebuild + start ALL Docker services (db, api, frontend)
# Run this in the terminal where docker is available.

Write-Host "==> Stopping any local processes on port 8000 / 8080..." -ForegroundColor Cyan
foreach ($port in @(8000, 8080)) {
    $pids = netstat -ano | Select-String ":$port" | Select-String "LISTENING" |
        ForEach-Object { ($_ -split "\s+")[-1] } | Sort-Object -Unique
    foreach ($p in $pids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Write-Host "    Killed PID $p (port $port)"
    }
}

Write-Host "==> Rebuilding and starting containers (db + api + frontend)..." -ForegroundColor Cyan
docker compose up --build -d

Write-Host ""
Write-Host "==> Waiting for API to be ready..." -ForegroundColor Cyan
$max = 30
for ($i = 0; $i -lt $max; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Write-Host "==> API is UP!" -ForegroundColor Green
            break
        }
    } catch { }
    Write-Host "    Waiting... ($($i*2)s)"
}

Write-Host ""
Write-Host "==> Waiting for Frontend to be ready..." -ForegroundColor Cyan
for ($i = 0; $i -lt $max; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8080" -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Write-Host "==> Frontend is UP!" -ForegroundColor Green
            break
        }
    } catch { }
    Write-Host "    Waiting... ($($i*2)s)"
}

Write-Host ""
Write-Host "    App:           http://localhost:8080"
Write-Host "    API Docs:      http://localhost:8000/docs"
Write-Host "    API Health:    http://localhost:8000/health"
