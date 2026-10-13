# GameForge Engine — architecture

The engine is a browser-first TypeScript game engine that lives *beside* the portal, not inside it.
Three products share one repository and depend on each other in one direction only:

```text
GameForge Engine      runs game loops, manages entities and scenes, renders, loads assets
      ^
GameForge Pipeline    validates projects, compiles games, processes assets, produces builds
      ^
GameForge Portal      discovers and indexes builds, launches games, shows reports, packages the app
```

The portal never imports engine internals, and the engine never imports the portal. The pipeline is
the only layer that knows about both, which is what lets the engine be tested with no browser and the
portal keep working while the engine grows.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Core | `engine/src/core` | `Engine`, `World`, `Scene`, `GameLoop`, `Clock`, `EventBus`, component/system contracts |
| ECS | `engine/src/ecs` | `EntityManager`, `ComponentStore`, `Query` |
| Math | `engine/src/math` | `Vector2`, `Rectangle`, `Color`, scalar helpers |
| Renderer | `engine/src/renderer` | `Renderer` contract, `Canvas2DRenderer`, `Camera`, `Sprite`, `Material`, `Texture`, `RenderQueue`, primitives |
| Assets | `engine/src/assets` | `AssetManager`, manifest validation, loaders, reference-counted cache |
| Input | `engine/src/input` | `Keyboard`, `Mouse`, `Touch`, action `InputMap` |
| Systems | `engine/src/systems` | `InputSystem`, `TransformSystem`, `ScriptSystem`, `RenderSystem` |
| Scripting | `engine/src/scripting` | `Script` base class and the lifecycle invoker |
| Diagnostics | `engine/src/diagnostics` | `Logger`, `Metrics`, `Profiler`, `DebugDraw` |
| Platform | `engine/src/platform` | `BrowserPlatform`, `ElectronPlatform`, `HeadlessPlatform` |

## Ownership and lifetimes

`Engine` owns the platform, renderer, world, loop and services. `World` owns entities, components,
systems and scenes and knows nothing about the DOM — that is what makes headless runs possible.
`Renderer` owns the canvas. Systems reach shared resources through `world.services` (a typed bag the
engine fills in), so a system never imports `Engine` and no import cycle forms.

## The loop

`GameLoop` runs a fixed-rate simulation with a variable-rate render:

1. `frame(delta)` clamps the delta (`maxDeltaTime`, default 0.25 s) so a stalled tab cannot teleport
   the simulation,
2. accumulates and runs whole `fixedTimeStep` slices (default 1/60 s),
3. drops the backlog if it exceeds `maxSubSteps`, reporting it in `stats.droppedTime` rather than
   spiralling,
4. renders once with an interpolation `alpha`.

`advance(steps)` runs exactly N fixed steps with no scheduler at all. That single method is why the
engine can be tested deterministically: the integration tests assert that two identical runs produce
identical state, and the browser smoke test drives frames explicitly instead of waiting for
`requestAnimationFrame`.

## Components are data, systems are behaviour

A component is a plain class implementing the empty `Component` marker. `ComponentStore` keys
components by their **concrete constructor**, which keeps lookups O(1) and iteration tight. The
consequence is deliberate and worth knowing: `storageFor(Script)` does **not** find a `Script`
subclass. Systems that need polymorphic access discover concrete types instead — `ScriptSystem`
inspects the registered types once and filters for `Script` subclasses.

Queries (`world.query(Sprite, Transform)`) iterate the rarest component and probe the rest with O(1)
lookups, so cost tracks the scarcest type rather than the entity count.

## Scenes and entity lifetime

One scene is active at a time. Activating a different scene destroys the outgoing scene's entities
(default; `destroyEntitiesOnSceneSwitch: false` opts out for overlay scenes). Entity ids are
monotonic and never reused, so a stale reference always fails `isAlive` instead of silently
addressing a different entity.

Component teardown goes through `ComponentHooks.onDetach`, which fires *before* the component is
dropped. That ordering matters: by the time `entity:destroyed` is emitted the component store has
already released the component, so an event listener could never find it. `Script.onDetach` uses
this to guarantee `onDestroy` runs exactly once.

## Rendering

`Renderer` is a small contract (`beginFrame` / `draw` / `endFrame` / `resize`), and
`Canvas2DRenderer` is the reference implementation. Systems do not touch the canvas: they enqueue
`DrawCommand` values into the world's `RenderQueue`, which stable-sorts by layer then insertion
order, so two sprites on one layer keep the order they were queued. `RenderSystem` finds the camera
(explicit override, then the first `Camera` component), culls against its view bounds, and submits.

The WebGL2 backend will implement the same contract; game code and systems will not change. The
engine deliberately **throws** when `renderer: 'webgl2'` is requested today rather than silently
falling back, because a silent fallback hides unfinished work.

## Assets

Everything a game loads is declared in `game.json`-adjacent `manifest.json`, produced by the
pipeline from the real shipped bytes (`sha256:<hex>` of each copied file). `AssetManager` returns
handles immediately and de-duplicates concurrent requests for the same id, so ten entities asking for
one texture cause one request. A failed asset raises an event and is reported, but never aborts the
batch: one missing texture should not stop a game from starting.

`cache/prune()` drops only unreferenced entries, which is what keeps a scene transition from leaking
the previous level's textures.

## Errors and diagnostics

Systems are wrapped in `try`/`catch` per system per frame: a throwing system is reported with its
name and the rest of the frame still runs. `Logger` keeps a bounded ring buffer, which is how the
desktop shell and the portal can show a game's output without a devtools window. `Metrics` is fed by
the engine (frame times, draw calls, entity counts) and is what `runtimeState()` reports.
`Profiler` is opt-in and free when disabled.

## Headless and deterministic modes

`new Engine({ headless: true })` uses `HeadlessPlatform` (virtual clock, manually pumped frames) and a
`Canvas2DRenderer` with no canvas — draw calls are counted but nothing is painted. This is the mode CI
and the unit tests use; it is also what makes "does this game boot and simulate?" a fast assertion
rather than a browser launch.
