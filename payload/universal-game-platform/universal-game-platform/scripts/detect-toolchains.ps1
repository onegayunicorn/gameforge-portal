#requires -Version 7.0
# Detect available compilers and toolchains
$toolchains = @{}
foreach ($cmd in @("node","pnpm","rustc","cargo","clang","gcc","emcc","javac","adb","xcodebuild")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $version = (& $cmd --version 2>$null | Select-Object -First 1)
        $toolchains[$cmd] = $version
        Write-Host "FOUND: $cmd -> $version" -ForegroundColor Green
    } else {
        Write-Host "MISSING: $cmd" -ForegroundColor Yellow
    }
}
$toolchains | ConvertTo-Json | Out-File "build/toolchains.json"
