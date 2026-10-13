# bootstrap.ps1 - Monolith Bay Windows bootstrap
$ErrorActionPreference = "Stop"
Write-Host "Bootstrapping Monolith Bay development environment..."
corepack enable
corepack prepare pnpm@9.15.0 --activate
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm install --frozen-lockfile
Write-Host "Bootstrap complete. Run 'pnpm dev' to start."
