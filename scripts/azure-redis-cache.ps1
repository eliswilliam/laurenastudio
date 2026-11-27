# Requires: Azure CLI (`az login`), rights to create Azure Cache for Redis in the subscription.
# Creates a Basic C0 Redis instance and prints REDIS_URL for App Settings (rediss:// + SSL port 6380).
# Azure Cache for Redis pode levar 15–45 min a ficar pronto.
#
# Uso:
#   .\scripts\azure-redis-cache.ps1 -ResourceGroup "rg-laurena" -Location "westeurope" -Name "laurenastudio-redis"

param(
    [Parameter(Mandatory = $true)][string]$ResourceGroup,
    [Parameter(Mandatory = $true)][string]$Location,
    [Parameter(Mandatory = $true)][string]$Name
)

$ErrorActionPreference = "Stop"

Write-Host "Subscription:" -ForegroundColor Cyan
az account show --query "{name:name, id:id}" -o table

Write-Host "`nCreating resource group (if missing)..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --output none

Write-Host "`nCreating Azure Cache for Redis (Basic C0) — pode demorar 15–45 min (bloqueia até terminar)..." -ForegroundColor Yellow
# Não uses --enable-non-ssl-port (porta 6379 sem TLS); ARQ usa rediss:// na 6380.
az redis create `
    --resource-group $ResourceGroup `
    --name $Name `
    --location $Location `
    --sku Basic `
    --vm-size c0 `
    --output none

Write-Host "`nWaiting for Redis to be ready (querying every 30s)..." -ForegroundColor Cyan
do {
    $state = az redis show --resource-group $ResourceGroup --name $Name --query "provisioningState" -o tsv 2>$null
    if ($state -eq "Succeeded") { break }
    Start-Sleep -Seconds 30
} while ($true)

$keys = az redis list-keys --resource-group $ResourceGroup --name $Name | ConvertFrom-Json
$hostName = az redis show --resource-group $ResourceGroup --name $Name --query "hostName" -o tsv
$primaryKey = $keys.primaryKey

# redis-py / ARQ: SSL on 6380 — use rediss://
$redisUrl = "rediss://:$primaryKey@${hostName}:6380/0"

Write-Host "`n=== Adicione no Azure App Service (Configuration / Application settings) ===" -ForegroundColor Green
Write-Host "REDIS_URL=$redisUrl"
Write-Host "`n(Se arq/redis recusar rediss, use um contentor redis no docker-compose.azure.yml em vez de Azure Cache.)"
