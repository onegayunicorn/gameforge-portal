# Windows packaging CI

## Purpose and scope

This workflow automates the repeatable Windows verification and packaging work described in the supplied Executive Audit: verify, Electron checks, packaged payload integrity, NSIS/portable artifacts, and checksums. It makes the job result and downloadable evidence visible on GitHub.

It **does not replace full G1 acceptance**: real NSIS installation/uninstallation, installed-path behaviour, SmartScreen/signing review, and hardware-specific behaviour still need deliberate acceptance checks. It creates unsigned CI test artifacts, not production releases.

## Files

- `.github/workflows/windows-packaging.yml`: push-to-main, pull-request and manual triggers; Windows x64 runner; Node 22; read-only repository permission; no publishing or signing secrets.
- `scripts/ci/windows-packaging.ps1`: logged execution, JSON assertions, packaging/integrity checks and smoke-test stages.
- `docs/WINDOWS_CI.md`: these operating notes.

## Checks

1. Clean GitHub Actions checkout; do not persist checkout credentials.
2. Node 22.12+ within 22.x and npm 10.9+ within 10.x; install locked dependencies including dev tools and Electron's installation script.
3. `npm run verify`: TypeScript, tests, game validation and game builds. Do not hardcode 68 passes or force the symlink test to skip. Test count follows the checked-out code; symlink coverage may pass normally or visibly skip on permission errors.
4. `npm audit --audit-level=high`: high/critical findings fail the job. Moderate findings remain visible in logs and are not described as zero vulnerabilities.
5. `npm run pwa:build`, then Windows Electron PWA audit and game smoke checks.
6. `npm run dist -- --publish never`: explicit non-publishing override even before PR #3's script change reaches main. If the script already contains the identical option, both values remain `never`.
7. Exactly one nonempty x64 NSIS Setup EXE and one Portable EXE in `release-final/`; generate `SHA256SUMS.txt` and `windows-build-manifest.json` with sizes, hashes and Authenticode status.
8. Compare packaged `payload/` and `build-meta/` against their source trees by file count and per-file SHA-256, including dotfiles. Never assume the audit's historical count remains constant.
9. Run both `--selftest` and `--games-selftest` on `win-unpacked/GameForge Portal.exe` and the Portable EXE. Launch from an otherwise empty directory, not the source root. Require process exit zero and valid success JSON. Independently assert portal content, desktop bridge, layout, drawer and screenshots because the repository portal harness alone reports `ok: true` without asserting all probe fields.
10. Upload separate evidence and binary artifacts. Evidence upload runs even on failure; binary upload occurs only after successful verification. Retention is 14 days. No release is created and no EXE is installed or uninstalled.

Each app test has a five-minute timeout; the job has a 60-minute timeout. Superseded runs for the same ref are cancelled.

## Applying the prepared change

The accompanying `gameforge-windows-ci.patch` adds all three files and has been checked against current main (`5abecdb`). From a clean local branch in the repository:

```powershell
git switch -c chore/windows-packaging-ci
git apply --check .\gameforge-windows-ci.patch
git apply .\gameforge-windows-ci.patch
git add .github/workflows/windows-packaging.yml scripts/ci/windows-packaging.ps1 docs/WINDOWS_CI.md
git diff --cached --check
```

Adjust only the patch's local filename location as needed. Publishing this branch or opening a PR is a separate authorised step; neither was done when preparing these files.

## Running and making the check required

- The workflow verifies the ordinary checked-out PR merge result or main commit. It does **not** fetch or secretly combine PRs #1, #2 and #3. To validate their combination before landing, use an explicitly prepared integration branch/PR or the supplied local G1 script.
- Review sequencing with #1/#2/#3. Before their changes are included, the job only tests the code actually present. An older Windows symlink test or browser-play implementation may still fail; do not present that as a run of the combined fixes.
- Once present on the default branch, run it from Actions using the workflow's manual trigger, or let push/PR events start it.
- Inspect the first successful Windows run, especially portable launcher stdout/argument forwarding, before treating this workflow as proven. A launcher that exits early or suppresses its report must fail closed, not count as a pass.
- A passing job is not automatically a required merge gate. A maintainer must separately add `Verify, package and smoke-test (Windows x64)` to the applicable branch protection/ruleset. This preparation does not change protection settings.
- Do not use `pull_request_target` to run PR code, add repository write permissions, provide release/signing secrets to untrusted PR builds, disable Electron sandboxing, or apply force dependency fixes to obtain a green run.

## Evidence

- `windows-verification-<run_id>-<attempt>`: source SHA/environment, command logs and exit codes, parsed Electron reports, screenshots, payload/metadata inventories, build manifest and any failed-stage report.
- `windows-x64-test-builds-<run_id>-<attempt>`: Setup/Portable EXEs, `SHA256SUMS.txt`, `windows-build-manifest.json`.

GitHub also records the run and job status; a successful run writes a step summary explicitly retaining manual acceptance and signing limits.

## Validation performed during preparation

- GitHub Actions syntax checked with actionlint: passed.
- PowerShell syntax checked with PowerShell's own parser: passed.
- Helper tests with mocked processes: valid reports/paths with spaces accepted; `ok: false`, nonempty problems and incomplete portal reports rejected.
- Real temporary file tests: matching payload/dotfile hashes accepted; changed hashes and count mismatches rejected.
- Patch application and whitespace checks: checked against the preparation baseline.

**Not yet validated:** no GitHub Actions Windows run or Windows binary build was performed during preparation. Mocked helper tests do not validate Windows process handling, Electron, NSIS, portable launch behaviour or runner compatibility. The prior Linux Electron success is separate evidence, not proof this workflow has passed.
