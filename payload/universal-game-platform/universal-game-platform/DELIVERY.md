# ⭐ Universal Game Platform — Delivery Manifest
**Package:** universal-game-platform-v1.0.0.zip
**Status:** PROTOTYPE
**Combines:** Full universal game development & deployment template from PDF blueprint

## Structure
- Root: 14 config files (package.json, pnpm-workspace, turbo, tsconfig, vitest, playwright, .env.example, etc.)
- Apps: 4 (studio, builder-cli, preview, asset-browser)
- Packages: 19 (7 contracts + asset-schema, shader-pipeline, build-graph, 3 registries, provenance, license-registry, diagnostics, telemetry, ui-kit, test-kit)
- Adapters: 10 (custom, godot, unity, unreal, bevy, babylon, three, phaser, playcanvas, blender)
- Targets: 11 (webgl2, webgpu, wasm, native-cpp, native-rust, android, ios, webxr, openxr, dedicated-server, headless)
- Game drop-in: full contract-compliant skeleton (manifest, src, content, assets, tests)
- Infra: docker, compose, nginx, cdn, terraform, kubernetes, monitoring, object-storage
- Deploy: 7 environments (web, desktop, mobile, xr, server, staging, production)
- Scripts: 9 (bootstrap sh+ps1, detect-toolchains, validate-game, build-game, test-game, package-game, deploy-staging, deploy-production, rollback)
- Docs: 10 (getting-started, game/runtime/asset contract, build-system, testing, deployment, adapters, security, operations)
- Tests/platform: 7 contract test suites
- Release: 10 target skeletons with build-info, release-manifest, checksums, sbom, provenance, licenses + PWA structure for web targets
- CI/CD: 4 workflows (ci, deploy-staging, deploy-production gated, security-audit) + CODEOWNERS + dependabot + PR template
