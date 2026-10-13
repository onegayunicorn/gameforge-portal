#requires -Version 7.0
param([string]$Target="webgl2")
Write-Warning "PRODUCTION DEPLOY — requires manual approval"
pnpm exec ugb deploy production --target $Target
