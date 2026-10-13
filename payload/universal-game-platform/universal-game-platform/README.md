# ⭐ Universal Game Development & Deployment Platform

**Drop-in game platform.** Any compatible game goes into `game/` and builds through the same pipeline.

## What This Is
A universal game development and deployment template. The platform owns the development, build, test, packaging, deployment, and operational lifecycle. The game itself is a replaceable implementation package.

## Supported
- 2D / 3D / Browser / Desktop / Mobile / XR / Server-authoritative
- Engine-generated (Unity, Unreal, Godot, Bevy) + Custom-engine + External engine
- Single-player / Multiplayer / Offline / Live-service

## Quick Start
```bash
pnpm install
pnpm run game:validate
pnpm run build --target webgl2
pnpm run preview
```

## Structure
- `apps/` — studio, builder-cli, preview, asset-browser
- `packages/` — runtime/renderer/input/audio/physics/network/save contracts, asset schema, shader pipeline, build graph, compiler/devkit/capability registries, provenance, license registry, diagnostics, telemetry, ui-kit, test-kit
- `adapters/` — custom, godot, unity, unreal, bevy, babylon, three, phaser, playcanvas, blender
- `targets/` — webgl2, webgpu, wasm, native-cpp, native-rust, android, ios, webxr, openxr, dedicated-server, headless
- `game/` — drop-in game package (replaceable)
- `infra/` — docker, compose, nginx, cdn, terraform, kubernetes, monitoring, object-storage
- `deploy/` — web, desktop, mobile, xr, server, staging, production
- `scripts/` — bootstrap, detect-toolchains, validate-game, build-game, test-game, package-game, deploy-staging, deploy-production, rollback
- `docs/` — getting-started, game-contract, runtime-contract, asset-contract, build-system, testing, deployment, adapters, security, operations
- `tests/platform/` — contract test suite
- `release/` — per-target release artifacts

## CLI
```bash
ugb init my-game
ugb game validate
ugb build --target webgl2
ugb test
ugb package
ugb deploy staging
ugb rollback
```
