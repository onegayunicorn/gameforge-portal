# Monolith Bay Build — Structure Overview

Generated from the complete build blueprint. Contains two major components:

## 1. Monolith Bay Game Monorepo (root)
- `apps/` — game-web, launcher, content-editor, character-tool, admin-console
- `packages/` — 25 shared libraries (core-runtime, game-state, quest-engine, relationship-engine, inventory-engine, dialogue-engine, activity-engine, world-engine, renderer, input-system, audio-system, save-system, validation, design-tokens, ui-components, etc.)
- `content/` — game data, manifests, original asset sources
- `tools/` — 13 asset pipeline and release tools
- `tests/` — unit, integration, gameplay, renderer, UI, accessibility, persistence, content, performance, security, e2e
- `scripts/` — 15 build/deploy/ops shell scripts + PowerShell bootstrap
- `config/` — defaults + per-environment (dev/staging/prod) runtime and services
- `infra/` — docker, nginx, cdn, terraform, kubernetes, monitoring
- `deploy/` — static, desktop, staging, production (release manifests, smoke tests, rollback plan)
- `security/` — threat model, policies, CSP, secret scan config, vulnerability response
- `ops/` — runbooks, dashboards, alerts, maintenance, backups, disaster recovery
- `docs/` — architecture, gameplay, UI, visuals, operations, compatibility

## 2. Ultimate Game Engine Builder (`ultimate-game-builder/`)
- Canonical project model (`project.ugb.json`)
- Studio UI + Builder CLI + services
- 5 native runtimes (WebGL2, WebGPU, WASM, Rust, C++)
- 14 external engine adapters (Godot, Unity, Unreal, Bevy, Babylon, Three.js, PlayCanvas, Blender, O3DE, Defold, Cocos, Stride, MonoGame, Phaser)
- 31 shared packages
- 7 project templates
- 11 tools
- 5 examples including monolith-bay-original
