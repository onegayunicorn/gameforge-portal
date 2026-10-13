# ♾️ Sovereign Game Universe — Ultimate Package

**The complete game development & distribution ecosystem.** Combines 6 blueprints:
1. Ultimate Game Engine Builder & Orchestration Platform (canonical project model + 14 engine adapters + unified build graph)
2. Creator-First Game Distribution Platform (itch.io-style marketplace)
3. Personal Server Development & Production Runtime (self-hosted sovereign)
4. Google Cloud Development & Production Build & Runtime (cloud deployment target)
5. The Game Bay — Game Engine Builder
6. The Game Bay Blueprint — Monolith Bay reference project

## Structure
- `platform/` — Engine builder, 14 adapters, 5 runtimes, 30+ packages, templates, tools
- `marketplace/` — Game distribution platform (accounts, publishing, commerce, delivery, community, moderation)
- `server/` — Personal server runtime (self-hosted, sovereign)
- `deploy/` — Deployment targets (gcp, personal, staging, production)
- `projects/monolith-bay-original/` — Reference game built on the platform
- `infra/` — Shared infrastructure (docker, k8s, terraform)
- `scripts/` — Bootstrap, build, test, package, deploy, rollback
- `docs/` — Architecture, project format, runtime, adapters, plugins, build system, deployment, licensing
- `tests/` — Schema, runtime, adapters, asset pipeline, build graph, visual, accessibility, performance, e2e

## Quick Start
```bash
pnpm install
pnpm --filter @ugb/builder-cli exec ugb init my-game --template webgl-game
pnpm --filter @ugb/builder-cli exec ugb build --target web-production
```
