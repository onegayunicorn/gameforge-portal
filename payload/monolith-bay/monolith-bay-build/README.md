# Monolith Bay — HTML5/WebGL Monorepo

An original interactive adventure game built as a browser-first HTML5/WebGL application with a full development, content, testing, and production pipeline.

> **Note:** This project is an original implementation. It may be used as an authorized compatibility project only with explicit rights-holder permission. No protected game assets, dialogue, characters, animations, or code are included.

## Quick Start

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
cp .env.example .env
pnpm install --frozen-lockfile
pnpm validate:content
pnpm dev
```

## Monorepo Layout

| Path | Purpose |
|------|---------|
| `apps/game-web` | Browser game runtime, UI, and renderer host |
| `apps/launcher` | Desktop launcher / updater |
| `apps/content-editor` | Content authoring tool |
| `apps/character-tool` | Character creator and PNG import/export |
| `apps/admin-console` | Release and content administration |
| `packages/*` | Shared runtime, gameplay, rendering, and utility libraries |
| `content/` | Game data, manifests, and original asset sources |
| `tools/` | Asset pipeline, validators, and release tooling |
| `tests/` | Unit, integration, gameplay, UI, e2e, and performance tests |
| `infra/` | Docker, nginx, Terraform, Kubernetes, monitoring |
| `deploy/` | Static, desktop, staging, and production release configs |
| `security/` | Policies, CSP, threat model, vulnerability response |
| `ops/` | Runbooks, dashboards, alerts, disaster recovery |
| `docs/` | Architecture, gameplay, UI, visuals, operations, compatibility |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run unit and integration tests |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm test:visual` | Run visual regression tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm validate:content` | Validate content manifests and assets |
| `pnpm package` | Full production build + validation + tests |
| `pnpm preview` | Preview production build |

## Runtime Targets

- WebGL2 (primary) with WebGPU-ready abstraction
- HTML/CSS UI layer over 3D canvas
- Offline-capable via IndexedDB + service worker
- Optional Electron/Tauri desktop wrapper

## License

See [LICENSE](./LICENSE). All original content is project-owned. Third-party assets require explicit license records in `content/licenses/`.
