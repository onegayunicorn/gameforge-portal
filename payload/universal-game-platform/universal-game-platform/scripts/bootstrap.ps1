#requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."
Write-Host "=== Universal Game Platform — Bootstrap ===" -ForegroundColor Cyan
corepack enable
corepack prepare pnpm@8.12.0 --activate
pnpm install --frozen-lockfile
Write-Host "=== Bootstrap complete ===" -ForegroundColor Green
