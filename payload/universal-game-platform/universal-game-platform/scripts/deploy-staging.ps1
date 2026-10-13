#requires -Version 7.0
param([string]$Target="webgl2")
pnpm exec ugb deploy staging --target $Target
