#requires -Version 7.0
param([string]$Target="webgl2")
pnpm exec ugb package --target $Target
pnpm exec ugb checksums
pnpm exec ugb sbom
pnpm exec ugb provenance
