param(
  [string]$Bucket = "builder_laurena",
  [string]$Prefix = "avatar/",
  [switch]$Apply,
  [switch]$DeleteLegacy
)

$ErrorActionPreference = "Stop"

$allowedLegacyExt = @(".jpg", ".jpeg", ".png", ".gif", ".webp")

function Get-ObjectNameFromUri {
  param([string]$Uri)
  $prefix = "gs://$Bucket/"
  if (-not $Uri.StartsWith($prefix)) {
    return ""
  }
  return $Uri.Substring($prefix.Length)
}

Write-Host "[avatar-migrate] Bucket: gs://$Bucket"
Write-Host "[avatar-migrate] Prefix: $Prefix"
Write-Host "[avatar-migrate] Mode: $([string]::Join('', @($(if ($Apply) { 'APPLY' } else { 'DRY-RUN' }), $(if ($DeleteLegacy) { ' + DELETE-LEGACY' } else { '' }))))"

$allUris = gcloud storage ls "gs://$Bucket/$Prefix**"
if (-not $allUris) {
  Write-Host "[avatar-migrate] Aucun objet trouvé sous $Prefix"
  exit 0
}

$legacyCandidates = @()
foreach ($uri in $allUris) {
  $u = $uri.Trim()
  if (-not $u) { continue }
  if ($u.EndsWith('/')) { continue }

  $name = Get-ObjectNameFromUri -Uri $u
  if (-not $name.StartsWith($Prefix)) { continue }

  $leaf = [System.IO.Path]::GetFileName($name)
  $ext = [System.IO.Path]::GetExtension($leaf).ToLowerInvariant()

  if ($ext -eq ".avatar") { continue }
  if ($allowedLegacyExt -notcontains $ext) { continue }

  $base = [System.IO.Path]::GetFileNameWithoutExtension($leaf)
  if ([string]::IsNullOrWhiteSpace($base)) { continue }

  $destName = "$Prefix$base.avatar"
  $destUri = "gs://$Bucket/$destName"

  $legacyCandidates += [PSCustomObject]@{
    SourceUri = $u
    SourceName = $name
    SourceExt = $ext
    BaseName = $base
    DestUri = $destUri
    DestName = $destName
  }
}

if ($legacyCandidates.Count -eq 0) {
  Write-Host "[avatar-migrate] Aucun avatar legacy a migrer."
  exit 0
}

Write-Host "[avatar-migrate] Legacy detectes: $($legacyCandidates.Count)"

$planned = @()
$alreadyCanonical = 0
foreach ($item in $legacyCandidates) {
  $destExists = $false
  try {
    $probe = gcloud storage ls $item.DestUri 2>$null
    if ($probe) { $destExists = $true }
  } catch {
    $destExists = $false
  }

  if ($destExists) {
    $alreadyCanonical++
    Write-Host "[skip] Canonique existe deja: $($item.DestUri)"
    continue
  }

  $planned += $item
  Write-Host "[plan] $($item.SourceUri) -> $($item.DestUri)"
}

if ($planned.Count -eq 0) {
  Write-Host "[avatar-migrate] Rien a copier (tout est deja migre)."
  Write-Host "[avatar-migrate] Legacy detectes: $($legacyCandidates.Count), deja migres: $alreadyCanonical"
  exit 0
}

if (-not $Apply) {
  Write-Host "[avatar-migrate] DRY-RUN: $($planned.Count) copie(s) planifiee(s)."
  exit 0
}

$copied = 0
$deleted = 0
$failed = 0

foreach ($item in $planned) {
  try {
    gcloud storage cp $item.SourceUri $item.DestUri | Out-Null
    gcloud storage objects update $item.DestUri --cache-control="no-store, max-age=0" --custom-metadata="user_id=$($item.BaseName),kind=avatar" | Out-Null
    $copied++
    Write-Host "[ok] Copie: $($item.SourceUri) -> $($item.DestUri)"

    if ($DeleteLegacy) {
      gcloud storage rm $item.SourceUri | Out-Null
      $deleted++
      Write-Host "[ok] Supprime legacy: $($item.SourceUri)"
    }
  } catch {
    $failed++
    Write-Host "[error] Echec migration: $($item.SourceUri) -> $($item.DestUri) :: $($_.Exception.Message)"
  }
}

Write-Host "[avatar-migrate] Termine. Copied=$copied Deleted=$deleted Failed=$failed Planned=$($planned.Count)"
if ($failed -gt 0) {
  exit 1
}
