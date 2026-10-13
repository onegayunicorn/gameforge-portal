#requires -Version 7.0
param([string]$Target="webgl2", [string]$Version="previous")
pnpm exec ugb rollback --target $Target --version $Version
