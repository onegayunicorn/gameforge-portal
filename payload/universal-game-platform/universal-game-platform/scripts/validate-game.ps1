#requires -Version 7.0
# Validate game.manifest.json and game contract compliance
param([string]$GamePath = "./game")
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$manifest = Get-Content "$GamePath/game.manifest.json" | ConvertFrom-Json
$checks = @(
    @{Name="game.manifest.json exists"; Test={Test-Path "$GamePath/game.manifest.json"}},
    @{Name="gameId valid"; Test={$manifest.gameId -match '^[a-z0-9-]+$'}},
    @{Name="version valid"; Test={$manifest.version -match '^\d+\.\d+\.\d+$'}},
    @{Name="entrypoint exists"; Test={Test-Path "$GamePath/$($manifest.entrypoints.web)"}},
    @{Name="targets valid"; Test={$manifest.targets.Count -gt 0}},
    @{Name="requireProvenance true"; Test={$manifest.requireProvenance -eq $true}},
    @{Name="requireLicenseRecords true"; Test={$manifest.requireLicenseRecords -eq $true}}
)
$failed = 0
foreach ($c in $checks) {
    if (& $c.Test) { Write-Host "PASS: $($c.Name)" -ForegroundColor Green }
    else { Write-Host "FAIL: $($c.Name)" -ForegroundColor Red; $failed++ }
}
if ($failed -gt 0) { throw "$failed validation checks failed" }
Write-Host "All game validation checks passed" -ForegroundColor Green
