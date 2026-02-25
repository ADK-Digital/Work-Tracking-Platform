param(
  [string]$OutputFile
)

$composeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "docker-compose.prod.yml" }
$dbService = if ($env:DB_SERVICE) { $env:DB_SERVICE } else { "db" }
$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { "./backups" }

if (-not (Test-Path $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

if (-not $OutputFile) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputFile = Join-Path $backupDir "postgres-backup-$timestamp.dump"
}

Write-Host "Creating backup at $OutputFile"
docker compose -f $composeFile exec -T $dbService sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > $OutputFile
Write-Host "Backup completed."
