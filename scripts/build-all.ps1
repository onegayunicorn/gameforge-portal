# One-shot rebuild: refresh the icon, rescan the payload, run the self test, then package.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-all.ps1 [-SkipSelfTest]

param(
  [switch]$SkipSelfTest
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host '==> icon' -ForegroundColor Cyan
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'make-icon.ps1')

  Write-Host '==> scan payload' -ForegroundColor Cyan
  & node (Join-Path $PSScriptRoot 'scan-builds.js')

  if (-not $SkipSelfTest) {
    Write-Host '==> self test' -ForegroundColor Cyan
    $electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
    if (-not (Test-Path $electron)) { throw "Electron not installed. Run: npm install" }
    $proc = Start-Process -FilePath $electron -ArgumentList '.', '--selftest', (Join-Path $root 'selftest') `
      -WorkingDirectory $root -Wait -PassThru -RedirectStandardOutput (Join-Path $root 'st.out') `
      -RedirectStandardError (Join-Path $root 'st.err') -WindowStyle Hidden
    Get-Content (Join-Path $root 'st.out') | Write-Host
    if ($proc.ExitCode -ne 0) {
      Get-Content (Join-Path $root 'st.err') | Write-Host -ForegroundColor Red
      throw "Self test failed (exit $($proc.ExitCode)). Packaging aborted."
    }
  }

  Write-Host '==> package' -ForegroundColor Cyan
  & npx electron-builder --win nsis portable --x64

  Write-Host '==> artifacts' -ForegroundColor Green
  Get-ChildItem (Join-Path $root 'release') -File |
    Where-Object { $_.Extension -in '.exe', '.blockmap', '.yml' } |
    Select-Object Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } } |
    Format-Table -AutoSize
}
finally {
  Pop-Location
}
