#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet("webgl2","webgpu","wasm","native-cpp","native-rust","windows","macos","linux","android","ios","webxr","openxr","server","headless")]
    [string]$Target = "webgl2",
    [ValidateSet("development","test","staging","production")]
    [string]$Profile = "development",
    [switch]$Install, [switch]$SkipTests, [switch]$Force
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
function Require-Command { param([Parameter(Mandatory)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command not found: $Name" } }
Require-Command -Name "node"; Require-Command -Name "pnpm"
if ($Install) { pnpm install --frozen-lockfile }
pnpm run game:validate; pnpm run content:validate; pnpm run assets:validate; pnpm run toolchains:detect
if (-not $SkipTests) { pnpm run typecheck; pnpm run lint; pnpm run test }
$buildDir = Join-Path "build" "$Target/$Profile"
New-Item -Path $buildDir -ItemType Directory -Force | Out-Null
pnpm exec ugb build --target $Target --profile $Profile
pnpm exec ugb package --target $Target --profile $Profile
Write-Host "Build completed: $buildDir" -ForegroundColor Green
