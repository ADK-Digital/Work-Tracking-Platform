param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile
)

$composeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "docker-compose.prod.yml" }
$dbService = if ($env:DB_SERVICE) { $env:DB_SERVICE } else { "db" }

if (-not (Test-Path $InputFile)) {
  throw "Backup file not found: $InputFile"
}

Write-Warning "This will overwrite database data in $dbService."

docker compose -f $composeFile exec -T $dbService sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"' | Out-Null
Get-Content -Path $InputFile -Encoding Byte -ReadCount 0 | docker compose -f $composeFile exec -T $dbService sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges'

Write-Host "Restore completed."
