# GameForge roadmap and implementation status

This is the honest state of the engine work against the six milestones. Everything in the
"implemented" column is verified by a test, a smoke test or the portal integration harness named
beside it — nothing here is a plan described in the present tense.

## Milestone status

| Milestone | State | Evidence |
|---|---|---|
| **1 — Engine foundation** | **Implemented** | `npm run engine:test` (50 tests), `npm run games:smoke` (real browser render + motion) |
| **2 — WebGL2 renderer** | **Not started** | Requesting it throws: `WebGL2 renderer is not implemented yet` |
| **3 — Asset and build pipeline** | **Implemented** | `tests/integration/game-build.test.ts`, `npm run game:build` producing a playable `dist/` |
| **4 — Input, audio, animation, physics** | **Input only** | Input has system-level tests; audio, animation and physics do not exist |
| **5 — Portal and Electron integration** | **Implemented (partial)** | `electron . --games-selftest` — build, validate, launch, stop, logs, and live runtime state |
| **6 — Editor foundation** | **Not started** | `tools/editor/` does not exist |

## Milestone 1 — engine foundation (implemented)

- **Math**: `Vector2`, `Rectangle`, `Color`, scalar helpers (`MathUtils`), including a seeded RNG for
  reproducible tests.
- **Core**: `Engine`, `World`, `Scene`, `EntityManager`, `ComponentStore`, `Query`, `GameLoop`,
  `Clock`, `EventBus`, component/system contracts, engine event catalogue.
- **Loop**: fixed-rate simulation with delta clamping, sub-step budget with dropped-time reporting,
  pause/resume, time scale, and `advance()` for scheduler-free deterministic stepping.
- **Renderer**: `Canvas2DRenderer` with camera transform, textured and solid quads (rotation, pivot,
  flip), circles/rings/lines, layers, alpha, three blend modes, and view culling.
- **Scene**: `Transform` with hierarchy composition, dirty tracking and dangling-parent tolerance.
- **Input**: `Keyboard`, `Mouse`, `Touch`, action `InputMap`, `InputSystem` keeping the pointer's
  world mapping pointed at the live camera.
- **Assets**: manifest validation, `Texture`/`Json`/`Text` loaders, request de-duplication with
  handles, progress reporting, reference-counted cache with pruning.
- **Diagnostics**: `Logger` with a bounded history, `Metrics`, opt-in `Profiler`, `DebugDraw`.
- **Platform**: browser, Electron (with a runtime-state bridge) and headless.
- **Runtime shell**: `bootstrap`, `GameHost`, loading and error screens, restart/fullscreen controls,
  generated `index.html` with a strict CSP.
- **Example**: `games/examples/hello-render` — textured sprite, scripted motion, camera follow,
  primitives, debug overlay.

## Milestone 3 — pipeline (implemented)

- JSON Schema for `game.config.json` plus runtime shape validation.
- Project discovery across `games/`, template-aware.
- Validators: entry existence/extension/shape, engine range, scene references, id format, asset glob
  resolution, duplicate asset ids, unreferenced assets.
- Asset pipeline: copy, `sha256` hashing of shipped bytes, manifest with ids/types/sizes.
- esbuild bundling with code splitting so the runtime and the game share **one** engine chunk.
- Generated runtime HTML, `game.json`, `runtime.css`, CSP.
- Post-build integrity check (`verifyBuildOutput`) before a build is declared successful.
- `build-report.json` for both outcomes, so a failure is explainable.
- CLI: `build`, `validate`, `create`, `dev`, `preview`, `--json` for machine consumption.
- `scripts/generate-game-index.js` → `portal/data/games.json`, the readiness ladder the portal reads.

## Milestone 5 — portal integration (implemented, with one gap)

- Games section rendering the measured state: *distribution-only scaffold* / *buildable* /
  *runnable* / *failed build*.
- Per-card actions: **Build**, **Preview/Play**, **Stop**, **Validate**, **Logs**, **Source**,
  **Open build**.
- Allow-listed IPC only. The renderer names an action and a game id; the main process resolves the id
  from `portal/data/games.json`, then verifies every path stays inside the repository root. A
  traversal id (`../../etc/passwd`) is refused — asserted in the harness.
- Builds run in a child process through a bundled CLI, so a runaway build cannot take the shell down
  and no system Node or tsx installation is required.
- Live game state: a launched game's engine reports through the `gameforge` preload bridge, the main
  process forwards it, and the card shows FPS, entities, draw calls and active scene.

**Gap:** the packaged `.exe` ships the portal and payload, but the extra resources needed to *build*
games inside the packaged app (engine source, `games/`, pipeline, runtime, esbuild, the CLI bundle)
are configured yet only verified in the development tree. Building from the desktop app is verified
with `electron . --games-selftest`; the packaged equivalent has not been re-verified since the change.

## Milestone 4 — remaining

Present: full input (keyboard, mouse, multi-touch, action mapping, pointer→world via camera).

Absent, in the order worth doing:

1. **Audio** — `AudioEngine`, `Sound`, `Music`, `AudioBus`, browser autoplay-unlock policy.
2. **Physics** — circle/AABB collision, fixed-step integration, `Collider`/`RigidBody` components and
   the shape set. The fixed-step loop already accommodates this.
3. **Animation** — `AnimationClip`, `Animator`, keyframes, `Tween`.
4. **Gamepad** — polling through `navigator.getGamepads()`.

## Deliberately deferred

- **3D** (`Vector3`, `Matrix3`, `Matrix4`, `Quaternion`) — the blueprint's own instruction is to build
  a reliable 2D renderer first. None of the 2D work depends on these.
- **Text rendering** — the renderer has no `drawText`. UI text needs a font/atlas decision, which
  belongs with the UI layer rather than as an ad-hoc canvas call.
- **UI layer** (`UiNode`, `UiLayout`, `Label`, `Panel`, `Button`) — needs text, and screen-space
  drawing (the renderer is world-space only today).
- **Scene serialisation** (`SceneSerializer`, `SceneLoader`, `Prefab`, `.scene.json`) — scenes are
  currently built in code. `game.config.json` accepts `scenes` globs, but nothing consumes them yet;
  shipping the field without an implementation would be misleading.
- **Editor** (`tools/editor/*`, play-in-editor) — milestone 6, and only worth building on a stable
  runtime.

## Known constraints

- **One active scene at a time.** Switching scenes destroys the outgoing scene's entities by default
  so queries stay global and cheap. Overlay scenes are possible but need `destroyEntitiesOnSceneSwitch: false`.
- **Scripts are synchronous.** `onStart`/`onUpdate`/`onDestroy` must not be `async`: a fixed step
  cannot depend on how long a promise takes to settle. Start async work in `onStart` and observe it
  in `onUpdate`.
- **Components are keyed by concrete constructor.** Querying a base class finds nothing; systems that
  need polymorphism discover concrete types (`ScriptSystem` does this).
- **One engine instance per page.** The bundle strategy guarantees it; a second `Engine` would mean a
  second canvas and a second loop.
- **Fonts and text are absent**, so the runtime's own UI is DOM (the shell) rather than drawn.

## Deviations from the original blueprint

| Blueprint | What was built | Why |
|---|---|---|
| Separate `engine.js` + `game.js` with the engine bundled into each | Both entries plus shared `chunk-*.js` chunks (esbuild splitting) | Duplicating the engine per bundle creates two engine instances and breaks `instanceof` across the boundary |
| `tsx tools/cli/gameforge.ts` for shell-driven builds | The CLI is also bundled to `build/gameforge-cli.cjs` | The Electron main process cannot import TypeScript, and a packaged app cannot assume tsx |
| `scripts/build-all-games.js`, `scripts/validate-project.js` | Inside the CLI (`build` with no argument, `validate`) plus `scripts/generate-game-index.js` | One implementation, reachable from terminal, CI and the shell |
| Playwright for browser integration testing | An Electron harness (`games:smoke`, `--games-selftest`) and vitest | No extra browser download, and the harness exercises the real preload/IPC surface the portal uses |
| `gameforge dev` with hot reload | Build + serve + rebuild on change | An HMR runtime needs module-ordering guarantees the engine does not provide yet; a reload that always reflects the last successful build is more trustworthy |
| `docs/ENGINE_API.md`, `RENDERING.md`, `ASSET_PIPELINE.md`, `EDITOR.md`, `CONTRIBUTING.md`, typedoc | `ENGINE_ARCHITECTURE.md`, `GAME_PROJECT_FORMAT.md`, `ROADMAP.md` | Three accurate documents beat six aspirational ones; the API is documented by its typed exports and tests |

## Suggested next steps

1. **Milestone 2 (WebGL2)** — the renderer contract and `Canvas2DRenderer` are the reference; the
   sprite batching and material sorting hooks are already in `RenderQueue`/`Material`.
2. **Packaged build path** — re-run `npm run dist`, then the packaged app's `--games-selftest`, and
   confirm builds work from the installed EXE.
3. **Text + UI** — unblocks the editor, HUDs and in-world labels.
4. **Physics** — the fixed timestep, `Transform` world composition and query system are the pieces it
   needs.
5. **A second example** (`platformer`) — would exercise input, collision and animation together and
   is the natural acceptance test for milestone 4.
