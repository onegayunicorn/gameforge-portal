#requires -Version 7.0
# Full developer bootstrap — install, validate, test, build, dev server
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 20+ is required." }
if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) { throw "Corepack is required." }
corepack enable; corepack prepare pnpm@9.15.0 --activate
if (-not (Test-Path -LiteralPath "game/game.manifest.json")) { throw "game/game.manifest.json not found. Add a compatible game package first." }
if (-not (Test-Path -LiteralPath "node_modules")) { pnpm install --frozen-lockfile }
pnpm run game:validate; pnpm run content:validate; pnpm run assets:validate
pnpm run typecheck; pnpm run lint; pnpm run test; pnpm run build
Write-Host "Starting development runtime..." -ForegroundColor Cyan
pnpm dev
