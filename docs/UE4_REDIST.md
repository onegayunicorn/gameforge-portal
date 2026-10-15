# UE4 runtime redistributables

GameForge's own engine is the TypeScript engine in [`engine/`](../engine/src/index.ts). Separately,
packaged **Unreal Engine 4** Windows games need an `Engine/` runtime tree beside their `.exe`:
PhysX/APEX/NvCloth, NVIDIA Blast, GeForce NOW and Aftermath, Ogg/Vorbis, XAudio 2.9, DbgHelp and
`UE4PrereqSetup_x64.exe` (21 files, ~61 MB, imported unchanged from `Engine.zip`, SHA-256
`dc289c013c64f90340375c09ad50f2e7417d1690d54f225a07c8424500c563e7`).

## Where the files live

| What | Where | Visibility |
| --- | --- | --- |
| The binaries | [`onegayunicorn/gameforge-ue4-redist`](https://github.com/onegayunicorn/gameforge-ue4-redist) | **Private** |
| Pinned SHA-256 per file | [`config/ue4-redist.sha256`](../config/ue4-redist.sha256) | This repo |
| Fetch / verify / stage tool | [`scripts/ue4-redist.js`](../scripts/ue4-redist.js) | This repo |
| Local working copy | `vendor/ue4-redist/` (git-ignored) | Your machine only |

The vendors (Epic, NVIDIA, Microsoft) license these files for redistribution *with a built game*, so
they are kept out of this public repository and out of the GameForge Portal installer (`payload/`).
GitHub has no per-branch privacy, so a separate private repository is how they stay private.

## Use

You need a git login that can read the private repository (your own account, or a deploy key /
`UE4_REDIST_REPO=git@github.com:onegayunicorn/gameforge-ue4-redist.git` for SSH).

```bash
npm run ue4:fetch                          # clone into vendor/ue4-redist/ and verify all 21 files
npm run ue4:verify                         # re-check against config/ue4-redist.sha256
npm run ue4:stage -- "C:\Games\MyUE4Game"  # copy Engine/ beside the game's launcher .exe, then re-verify
npm run ue4:test                           # unit tests (no private access needed)
```

Without network access to the private repo, `node scripts/ue4-redist.js fetch --from <folder>` loads an
extracted `Engine.zip` instead; it is verified against the same pinned hashes.

`stage` refuses a folder with no `.exe` (pass `--force` to override) and refuses to run if the local
copy fails verification. A packaged UE4 game's layout is `<Game>/<Game>.exe`, `<Game>/<Project>/…`
and `<Game>/Engine/…`; `stage` supplies the last of those.

## Updating the redistributables

1. Commit the new `Engine/` tree to the private repository and regenerate its `SHA256SUMS`
   (`find Engine -type f | sort | xargs sha256sum > SHA256SUMS`).
2. Copy that `SHA256SUMS` over `config/ue4-redist.sha256` here and open a PR.
3. `npm run ue4:fetch` then fails loudly until both sides agree.
