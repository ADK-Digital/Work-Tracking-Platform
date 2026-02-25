param(
  [string]$OutputPath
)

$composeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "docker-compose.prod.yml" }
$dbService = if ($env:DB_SERVICE) { $env:DB_SERVICE } else { "db" }
$minioService = if ($env:MINIO_SERVICE) { $env:MINIO_SERVICE } else { "minio" }
$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { "./backups" }

if (-not $OutputPath) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = Join-Path $backupDir "backup-$timestamp"
}

if (-not (Test-Path $OutputPath)) {
  New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

$dbOutputFile = Join-Path $OutputPath "postgres.dump"
$minioOutputFile = Join-Path $OutputPath "minio-data.tar.gz"

Write-Host "Creating PostgreSQL backup at $dbOutputFile"
docker compose -f $composeFile exec -T $dbService sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > $dbOutputFile

Write-Host "Creating MinIO backup at $minioOutputFile"
docker compose -f $composeFile exec -T $minioService sh -lc 'tar -C /data -czf - .' > $minioOutputFile

Write-Host "Backup completed: $OutputPath"
