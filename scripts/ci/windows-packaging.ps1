#requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('Install','Verify','Audit','BuildPwa','Electron','Package','PackagedSmoke','Finalize')][string]$Stage)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
if (-not $IsWindows) { throw 'Windows CI helper must run on Windows.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $env:RUNNER_TEMP) { throw 'RUNNER_TEMP is required; this helper targets GitHub Actions.' }
$evidence = Join-Path $env:RUNNER_TEMP 'gameforge-windows-ci'
$logs = Join-Path $evidence 'logs'
$captures = Join-Path $evidence 'captures'
New-Item -ItemType Directory -Path $evidence,$logs,$captures -Force | Out-Null
$previousLocation = Get-Location

function Write-JsonFile {
    param([object]$Value,[string]$Path)
    $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding utf8
}
function Invoke-Logged {
    param([string]$Label,[string]$Executable,[string[]]$ArgumentList)
    $log = Join-Path $logs "$Label.log"
    Write-Host "== $Label =="
    & $Executable @ArgumentList 2>&1 | Tee-Object -FilePath $log | ForEach-Object { Write-Host $_ }
    $code = $LASTEXITCODE
    Write-JsonFile @{label=$Label;exitCode=$code} (Join-Path $logs "$Label.exit.json")
    if ($code -ne 0) { throw "$Label failed with exit $code. See $log" }
}
function Invoke-AppTest {
    param([string]$Label,[string]$Executable,[string[]]$ArgumentList,[string]$WorkingDirectory=$repo,[switch]$Portal)
    $stdout = Join-Path $logs "$Label.stdout.log"
    $stderr = Join-Path $logs "$Label.stderr.log"
    $quoted = ($ArgumentList | ForEach-Object { '"' + $_.Replace('"','\"') + '"' }) -join ' '
    $process = Start-Process -FilePath $Executable -ArgumentList $quoted -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    if (-not $process.WaitForExit(300000)) {
        Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
        throw "$Label timed out after five minutes."
    }
    $process.WaitForExit()
    $code = $process.ExitCode
    Write-JsonFile @{label=$Label;exitCode=$code} (Join-Path $logs "$Label.exit.json")
    if ($code -ne 0) { throw "$Label failed with exit $code." }
    $text = Get-Content -LiteralPath $stdout -Raw
    if (-not $text) { throw "$Label returned no stdout report; not verified." }
    $start = $text.IndexOf('{')
    if ($start -lt 0) { throw "$Label returned no JSON report; not verified." }
    $result = $text.Substring($start) | ConvertFrom-Json
    if ($result.ok -ne $true) { throw "$Label does not report ok=true." }
    if ($result.PSObject.Properties.Name -contains 'problems') {
        if (@($result.problems).Count -ne 0) { throw "$Label reports test problems." }
    }
    if ($Portal) {
        # The repository's portal --selftest reports ok=true without asserting probes.
        # Assert the desktop bridge, content, layout and drawer independently here.
        if (@($result.captures).Count -ne 3) { throw "$Label needs three portal captures." }
        foreach ($capture in $result.captures) {
            if (-not $capture.bridge -or $capture.mode -ne 'Desktop app' -or
                $capture.cards -ne 3 -or $capture.stats -ne 6 -or $capture.rows -ne 3 -or
                $capture.docs -le 0 -or $capture.overflow -or @($capture.errors).Count -ne 0) {
                throw "$Label failed portal content/bridge/layout/error assertions."
            }
            if (-not (Test-Path -LiteralPath $capture.file) -or (Get-Item -LiteralPath $capture.file).Length -eq 0) {
                throw "$Label has a missing/empty portal screenshot."
            }
        }
        if (-not $result.captures[2].drawerOpen -or $result.captures[2].drawerBodyChars -le 0) {
            throw "$Label drawer did not render."
        }
    }
    Write-JsonFile $result (Join-Path $evidence "$Label.json")
}
function Assert-MirroredTree {
    param([string]$Name,[string]$Source,[string]$Destination)
    if (-not (Test-Path -LiteralPath $Source) -or -not (Test-Path -LiteralPath $Destination)) {
        throw "$Name source or packaged directory is missing."
    }
    $sourceFiles = @(Get-ChildItem -LiteralPath $Source -Recurse -File -Force)
    $destFiles = @(Get-ChildItem -LiteralPath $Destination -Recurse -File -Force)
    if ($sourceFiles.Count -ne $destFiles.Count) { throw "$Name packaged file count mismatch." }
    $rows = @()
    foreach ($file in $sourceFiles) {
        $relative = [IO.Path]::GetRelativePath($Source,$file.FullName)
        $target = Join-Path $Destination $relative
        if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "$Name missing packaged file: $relative" }
        $sha = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        if ($sha -ne (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash) { throw "$Name hash mismatch: $relative" }
        $rows += @{path=$relative;bytes=$file.Length;sha256=$sha}
    }
    Write-JsonFile @{name=$Name;files=$rows;count=$sourceFiles.Count;matched=$true} (Join-Path $evidence "$Name-inventory.json")
}

try {
    Set-Location $repo
    switch ($Stage) {
        'Install' {
            $version = [version]((& node.exe --version).Trim().TrimStart('v'))
            $npm = (& npm.cmd --version).Trim()
            if ($version.Major -ne 22 -or $version -lt [version]'22.12.0') { throw 'Use Node 22.12+ within 22.x.' }
            if (([version]$npm).Major -ne 10 -or [version]$npm -lt [version]'10.9.0') { throw 'Use npm 10.9+ within 10.x.' }
            if ((& node.exe -p 'process.arch').Trim() -ne 'x64') { throw 'Expected Windows x64 Node.' }
            $sha = (& git.exe rev-parse HEAD).Trim()
            if ($LASTEXITCODE -ne 0) { throw 'Cannot determine checked-out SHA.' }
            Write-JsonFile @{sha=$sha;event=$env:GITHUB_EVENT_NAME;ref=$env:GITHUB_REF;
                node=[string]$version;npm=$npm;windows=[Environment]::OSVersion.VersionString;
                runId=$env:GITHUB_RUN_ID;unsignedTestBuild=$true} (Join-Path $evidence 'environment.json')
            Invoke-Logged 'npm-ci' 'npm.cmd' @('ci','--include=dev','--ignore-scripts=false')
        }
        'Verify' { Invoke-Logged 'verify' 'npm.cmd' @('run','verify') }
        'Audit' { Invoke-Logged 'dependency-audit' 'npm.cmd' @('audit','--audit-level=high') }
        'BuildPwa' { Invoke-Logged 'pwa-build' 'npm.cmd' @('run','pwa:build') }
        'Electron' {
            $electron = Join-Path $repo 'node_modules\electron\dist\electron.exe'
            Invoke-AppTest 'pwa-audit' $electron @('scripts/pwa-audit.js',(Join-Path $captures 'pwa'))
            Invoke-AppTest 'game-smoke' $electron @('scripts/game-smoke.js','games/examples/hello-render/dist',(Join-Path $captures 'game'))
        }
        'Package' {
            # Pass the override explicitly even before PR #3's dist fix reaches main.
            # No GH_TOKEN, signing secrets, publish task or release creation is used.
            Invoke-Logged 'dist-no-publish' 'npm.cmd' @('run','dist','--','--publish','never')
            $release = Join-Path $repo 'release-final'
            $setup = @(Get-ChildItem -LiteralPath $release -Filter 'GameForge-Portal-Setup-*-x64.exe' -File)
            $portable = @(Get-ChildItem -LiteralPath $release -Filter 'GameForge-Portal-Portable-*-x64.exe' -File)
            if ($setup.Count -ne 1 -or $portable.Count -ne 1) { throw 'Expected one NSIS Setup and one Portable x64 EXE.' }
            $artifacts = @(); $sums = @()
            foreach ($file in @($setup[0],$portable[0])) {
                if ($file.Length -eq 0) { throw "Empty artifact: $($file.Name)" }
                $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
                $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
                $artifacts += @{name=$file.Name;bytes=$file.Length;sha256=$hash;signatureStatus=[string]$signature.Status}
                $sums += "$hash  $($file.Name)"
            }
            $sums | Set-Content -LiteralPath (Join-Path $release 'SHA256SUMS.txt') -Encoding utf8
            $manifest = @{sha=(& git.exe rev-parse HEAD).Trim();artifacts=$artifacts;unsignedTestBuild=$true;
                manualInstallerAcceptance='pending';productionSigning='not validated'}
            Write-JsonFile $manifest (Join-Path $release 'windows-build-manifest.json')
            Write-JsonFile $manifest (Join-Path $evidence 'windows-build-manifest.json')
            $resources = Join-Path $release 'win-unpacked\resources'
            Assert-MirroredTree 'payload' (Join-Path $repo 'payload') (Join-Path $resources 'payload')
            Assert-MirroredTree 'build-meta' (Join-Path $repo 'build-meta') (Join-Path $resources 'build-meta')
        }
        'PackagedSmoke' {
            $release = Join-Path $repo 'release-final'
            $app = Join-Path $release 'win-unpacked\GameForge Portal.exe'
            $emptyCwd = Join-Path $evidence 'empty-launch-directory'
            New-Item -ItemType Directory -Path $emptyCwd -Force | Out-Null
            Invoke-AppTest 'packaged-portal' $app @('--selftest',(Join-Path $captures 'packaged-portal')) -WorkingDirectory $emptyCwd -Portal
            Invoke-AppTest 'packaged-games' $app @('--games-selftest',(Join-Path $captures 'packaged-games')) -WorkingDirectory $emptyCwd
            $portable = @(Get-ChildItem -LiteralPath $release -Filter 'GameForge-Portal-Portable-*-x64.exe' -File)
            if ($portable.Count -ne 1) { throw 'Portable EXE missing or ambiguous.' }
            Invoke-AppTest 'portable-portal' $portable[0].FullName @('--selftest',(Join-Path $captures 'portable-portal')) -WorkingDirectory $emptyCwd -Portal
            Invoke-AppTest 'portable-games' $portable[0].FullName @('--games-selftest',(Join-Path $captures 'portable-games')) -WorkingDirectory $emptyCwd
        }
        'Finalize' {
            Write-JsonFile @{automatedChecksPassed=$true;manualInstallerAcceptance='pending';productionSigning='not validated'} (Join-Path $evidence 'success.json')
            if ($env:GITHUB_STEP_SUMMARY) {
                @'
## Windows automated verification passed
- Verify, high/critical audit, PWA build, Electron tests, packaging and packaged/portable self-tests passed.
- Payload and build metadata matched packaged copies by count and SHA-256.
- Download the binaries/hashes and separate verification evidence artifacts from this run.
- These are unsigned CI test builds, not production releases.
- Real NSIS install/uninstall, signing/SmartScreen review and manual G1 acceptance remain required.
'@ | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
            }
        }
    }
} catch {
    Write-JsonFile @{stage=$Stage;error=$_.Exception.Message;passed=$false} (Join-Path $evidence "failure-$Stage.json")
    throw
} finally { Set-Location $previousLocation }
