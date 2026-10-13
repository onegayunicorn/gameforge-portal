# GameForge Portal — Windows desktop app + website portal

A self-contained Windows application that packages three game-development builds, indexes them
locally, and serves a website portal from `127.0.0.1`. No network access is required at runtime.

Built with Electron + electron-builder. Output: an NSIS installer and a single-file portable `.exe`.

---

## What is inside the EXE

| Layer | Contents |
|---|---|
| Desktop shell | Electron main process, native menu, validated IPC surface (reveal / open / export) |
| Website portal | Static SPA (`portal/`) rendered entirely from a generated JSON index |
| Local web server | Read-only HTTP server on a random loopback port; also exposes `/api/runtime` |
| Embedded payload | Full source trees of the three builds, unpacked into `resources/payload/` |
| Build metadata | The supplied `.sha256` sidecar files, unpacked into `resources/build-meta/` |

Embedded builds:

| Id | Build | Kind |
|---|---|---|
| `universal-game-platform` | Universal Game Platform v1.0.0 | Platform monorepo (apps / packages / adapters / targets) |
| `sovereign-game-universe` | Sovereign Game Universe v1.0.0 | Multi-product universe (platform + marketplace + server + projects) |
| `monolith-bay` | Monolith Bay | Game monorepo (HTML5/WebGL) |

---

## Using the application

1. Run the installer, or launch the portable `.exe` directly.
2. The portal opens with an overview, per-project cards, an integrity table, a runtime panel and a
   documentation index.
3. `Inspect` on any project card opens a detail drawer with Overview / Structure / Docs / Entries /
   Integrity tabs.
4. Desktop-only actions (Reveal folder, Export copy, Open README / docs) run through the main
   process. In browser mode they are disabled and labelled as such.

### Native menu

| Menu | Actions |
|---|---|
| File | Reveal payload folder, Exit |
| View | Reload, zoom, fullscreen, dev tools |
| Help | Open portal in browser, About (versions and paths) |

### Security posture

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Preload exposes a fixed allow-list of IPC actions; anything else is refused
- Static server binds to `127.0.0.1` only, is read-only, and rejects path traversal
- The portal page carries a restrictive `Content-Security-Policy`
- Nothing is written to disk without an explicit folder choice in a native dialog

---

## Toolchain honesty note

The three supplied builds are **TypeScript scaffolds**, not runnable games:

- `universal-game-platform` ships a `dist/` tree of stub modules (a few hundred bytes per file) and
  four app shells whose `index.html` only loads `/src/index.ts`.
- `monolith-bay` ships source, content manifests and a Playwright suite but no compiled bundle.
- `sovereign-game-universe` is a multi-product scaffold with no HTML entry points at all.

The portal reports these facts as measured (file counts, module sizes, entry points, digests) instead
of presenting the builds as playable. Running any build requires installing its own toolchain
(`pnpm` + `turbo`) and building it from the exported source.

---

## Repository layout

```text
game-portal-exe/
├── electron/
│   ├── main.js            # app lifecycle, IPC handlers, self test, window/menu
│   ├── preload.js         # contextBridge allow-list
│   └── static-server.js   # read-only loopback HTTP server (shared with the PWA tooling)
├── portal/                # single source of truth for the interface
│   ├── index.html         # portal shell
│   ├── styles.css         # dark responsive theme
│   ├── app.js             # rendering, filters, drawer, actions
│   └── data/builds.json   # generated index (see scripts/scan-builds.js)
├── pwa-src/               # PWA-only sources (never edited in the generated pwa/)
│   ├── manifest.template.json, sw.js, pwa.css, pwa.js, offline.html, head.html
├── pwa/                   # GENERATED installable site - do not edit by hand
├── scripts/
│   ├── scan-builds.js     # scans payload -> builds.json (reused at runtime for Recompute)
│   ├── build-pwa.js       # assembles pwa/ from portal/ + pwa-src/, hashes the cache name
│   ├── serve.js           # browser-only static server (npm run serve)
│   ├── serve-pwa.js       # LAN server for phone testing (npm run pwa:serve)
│   ├── pwa-audit.js       # installability + offline audit (npm run pwa:audit)
│   ├── pwa-offline-debug.js  # offline-path diagnostic
│   ├── after-pack.js      # restores .gitkeep placeholders the packager filters
│   ├── make-icon.ps1      # builds build/icon.ico from the hex mark geometry
│   ├── make-pwa-icons.ps1 # renders the PWA icon set
│   └── diag-load.js       # loopback reachability diagnostic
├── build/                 # icon.ico, icon.png (electron-builder resources)
├── build-meta/            # supplied .sha256 sidecar files
├── payload/               # embedded build trees
├── selftest*/             # PNG captures from the self tests and audits
├── release-final/         # packaged installers / portable exe
└── gameforge-portal-pwa-1.0.0.zip   # deployable PWA bundle (+ .sha256)
```

---

## Commands

```powershell
npm install                 # electron + electron-builder
npm run scan                # regenerate portal/data/builds.json from payload/
npm run serve               # serve the portal as a website at http://127.0.0.1:4173
npm start                   # run the desktop app in development
npm run dist                # build NSIS installer + portable exe into release-final/
powershell -File scripts\build-all.ps1   # icon + scan + self test + package, in order
```

### Self test

`electron . --selftest <outDir>` renders the portal offscreen at 1440×940, 390×844, and a drawer-open
state, writes PNG captures, and prints a JSON report (element counts, overflow detection, console
errors). Exit code is non-zero if any capture fails.

---

## Installable mobile site (PWA)

`pwa/` is the same portal built as an installable web app, for phones and tablets.

```powershell
npm run pwa:build     # assemble pwa/ (icons, manifest, service worker, hashed cache name)
npm run pwa:serve     # serve it for phone/layout testing on http://<lan-ip>:4180
npm run pwa:audit     # Electron audit: installability + a real offline reload
```

`gameforge-portal-pwa-1.0.0.zip` contains exactly the audited `pwa/` tree (with a `.sha256`
sidecar) and can be dropped onto any static host as-is.

### What the PWA adds

| Piece | Detail |
|---|---|
| `manifest.webmanifest` | `name`/`short_name`, `display: standalone`, relative `start_url`/`scope`, theme + background `#070a12`, 4 icons (192/512, `any` + `maskable`), 2 screenshots, 3 shortcuts |
| `sw.js` | Precaches every shipped file under a content-hash cache name (`gameforge-pwa-<hash>`); network-first for documents, cache-first for assets; `/api/runtime` is deliberately never cached |
| `offline.html` | Fallback page for an uncached navigation while offline |
| `pwa.js` | Service-worker lifecycle, install state machine, iOS "Add to Home Screen" sheet, offline/online dock, update toast, mobile tab bar with scroll-spy |
| `pwa.css` | Bottom tab bar with safe-area insets, 44px+ touch targets, stacked integrity cards instead of a sideways table, full-width drawer on phones |
| Icons | Rendered from the same hex mark as the desktop app; maskable variants are padded to the 80% safe zone |

### Install behaviour

- **Android / Chrome, Edge, Samsung Internet** — `beforeinstallprompt` is captured, the install card
  and the tab-bar Install button appear, and tapping either opens the native install prompt.
- **iOS Safari** — no `beforeinstallprompt` on iOS, so the card shows a "Show me how" button that
  opens a sheet with the Share → *Add to Home Screen* steps.
- **Already installed** — detected via `display-mode: standalone` and `navigator.standalone`; the
  install UI hides and the card reports the installed state.
- **Updates** — a waiting service worker raises a "A new version is ready" toast with a Reload action.

### Serving requirement

Browsers only register service workers and offer installation on a **secure context**: `https://`, or
`http://localhost`. A plain-HTTP LAN address (`http://192.168.x.x:4180`) is fine for checking layout
and behaviour, but cannot be installed — use HTTPS, a tunnel, or a static host for real device installs.

### Verified by `npm run pwa:audit`

Run against the built files in Electron, at 390×844 and 1440×940, then repeated with the web server
**shut down**:

- every declared asset (page, manifest, worker, CSS/JS, data, all icons and screenshots) returns 200
- manifest parses with `display: standalone`, relative `start_url`, maskable icons present
- service worker registers, activates, takes control, and fills a cache with all 18 precache entries
- tab bar renders with 4 section links; install card renders; no horizontal overflow; no console errors
- a synthetic `beforeinstallprompt` flips the install state to available and reveals both install buttons
- **offline reload with no server**: the document, index data and documentation all render from cache

> Note: Chromium does not fire a real `beforeinstallprompt` inside an Electron window, so the
> browser's own install eligibility decision cannot be asserted from this harness — only the
> prerequisites and the app's own wiring are. That is why the synthetic event check exists.

---

## Build notes (Windows)

Two packaging obstacles were hit and fixed; both are already applied in the repo.

1. **`winCodeSign` extraction fails without symlink privilege.** The 7z archive contains macOS
   `.dylib` symlinks, and 7-Zip aborts with *"Cannot create symbolic link: A required privilege is
   not held by the client"*. All Windows tools it actually needs (`rcedit-x64.exe`, `windows-10`,
   `openssl-ia32`) extract fine, so the extracted folder is copied to the cache path
   electron-builder looks for:

   ```powershell
   $cache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
   Copy-Item "$cache\<extracted-hash-dir>" "$cache\winCodeSign-2.6.0" -Recurse
   ```

2. **A locked `app.asar` aborts packaging.** After the first partial build, Windows Defender held a
   handle on `resources\app.asar`, so `EnsureEmptyDir` failed with *"The process cannot access the
   file because it is being used by another process"*. Two measures remove the failure mode:
   `"asar": false` (no asar archive is created at all) and building into a fresh output directory.
   The stale `release/` folder from that attempt still holds one locked file and can be deleted once
   the handle is released.

### Payload fidelity

electron-builder's file matcher drops `**/.gitkeep` placeholder files, which would leave 24 embedded
directories empty. `scripts/after-pack.js` copies them back after packaging and **fails the build**
if the packaged payload does not match the source count (`source=1315 packaged=1315`). Verified in
the build log and from inside the packaged app.

### Signing

No code-signing certificate is configured, so `signing is skipped` for every artifact. Windows will
therefore show an unknown-publisher warning on first launch. Sign the binaries with your own
certificate (`CSC_LINK` / `CSC_KEY_PASSWORD`) before distributing.

---

## Integrity model

- **Expected archive digest** — read from the supplied `.sha256` sidecars for
  `universal-game-platform-v1.0.0-BUILT.zip` and `sovereign-game-universe-v1.0.0.zip`. No sidecar was
  supplied for Monolith Bay, so the portal shows `no sidecar` rather than inventing one.
- **Live tree digest** — `sha256` over sorted `path + size + file hash` for every embedded file.
  This identifies the exact payload revision inside the EXE. `Recompute` re-runs the scan against
  the payload on disk.
