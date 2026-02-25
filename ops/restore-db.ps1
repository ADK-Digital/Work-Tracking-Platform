param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile
)

$composeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "docker-compose.prod.yml" }
$dbService = if ($env:DB_SERVICE) { $env:DB_SERVICE } else { "db" }
$minioService = if ($env:MINIO_SERVICE) { $env:MINIO_SERVICE } else { "minio" }

if (-not (Test-Path $InputFile)) {
  throw "Backup path not found: $InputFile"
}

$dbBackupFile = $InputFile
$minioBackupFile = $null

if ((Get-Item $InputFile).PSIsContainer) {
  $dbBackupFile = Join-Path $InputFile "postgres.dump"
  $minioBackupFile = Join-Path $InputFile "minio-data.tar.gz"
}

if (-not (Test-Path $dbBackupFile)) {
  throw "Postgres backup file not found: $dbBackupFile"
}

Write-Warning "This will overwrite database data in $dbService."

docker compose -f $composeFile exec -T $dbService sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"' | Out-Null
Get-Content -Path $dbBackupFile -Encoding Byte -ReadCount 0 | docker compose -f $composeFile exec -T $dbService sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges'

if ($minioBackupFile) {
  if (-not (Test-Path $minioBackupFile)) {
    throw "MinIO backup file not found: $minioBackupFile"
  }

  Write-Host "Restoring MinIO data in $minioService."
  docker compose -f $composeFile exec -T $minioService sh -lc 'find /data -mindepth 1 -delete' | Out-Null
  Get-Content -Path $minioBackupFile -Encoding Byte -ReadCount 0 | docker compose -f $composeFile exec -T $minioService sh -lc 'tar -C /data -xzf -'
}

Write-Host "Restore completed."
