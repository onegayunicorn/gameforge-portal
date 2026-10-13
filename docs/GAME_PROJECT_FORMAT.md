# Game project format

A game is a folder with a `game.config.json` at its root. Everything else is conventional.

```text
games/examples/hello-render/
├── game.config.json      # required: id, name, version, entry (+ optional build settings)
├── src/
│   └── main.ts           # exports setup(engine) - the game module
├── assets/               # copied and hashed into the build (declared by globs)
└── dist/                 # build output (generated; not committed)
```

## game.config.json

Schema: [`tools/schemas/game-config.schema.json`](../tools/schemas/game-config.schema.json).

| Field | Required | Default | Meaning |
|---|---|---|---|
| `id` | yes | — | Lowercase kebab-case, 2–63 chars. Used as the build folder name and the portal's game id. |
| `name` | yes | — | Display name in the runtime shell and the portal. |
| `version` | yes | — | Semantic version of the game. |
| `entry` | yes | — | Module exporting `setup(engine)`. Relative to the project root. |
| `description` | no | `''` | One line shown on the portal card. |
| `engine` | no | `^0.1.0` | Engine range this game targets; a mismatch is reported as a warning. |
| `type` | no | `2d` | Only `2d` is implemented. |
| `renderer` | no | `auto` | `auto` \| `canvas2d` \| `webgl2`. `webgl2` is not implemented yet. |
| `width` / `height` | no | 1280×720 | Canvas size (64–7680 / 64–4320). |
| `fixedTimeStep` | no | 1/60 | Simulation step, seconds. |
| `clearColor` | no | `#0b1020` | Validated as a hex colour before it reaches CSS. |
| `pixelArt` | no | `false` | Disables image smoothing for crisp scaled sprites. |
| `debug` | no | `false` | Enables debug draw, the profiler and verbose logging. |
| `scenes` | no | `[]` | Scene files to copy into the build. Scene *serialisation* is not implemented yet. |
| `assets` | no | `[]` | Globs copied and hashed into the build. |
| `tags` | no | `[]` | Free-form, surfaced in the portal. |

## The game module

```ts
import { Color, Engine, Scene, Sprite, Transform, Vector2 } from '@gameforge/engine';
import type { Game } from '@gameforge/engine';

export const game: Game = {
  async setup(engine) {
    const scene = new Scene('main');
    engine.world.addScene(scene);
    engine.world.setActiveScene(scene);

    engine.world.spawn(
      new Transform(new Vector2(0, 0)),
      new Sprite({ width: 64, height: 64, color: Color.fromHex('#6ea8ff') }),
    );
  },
};

export default game;
```

Either a named `setup` export or a default export is accepted. `setup` is awaited before the first
frame, so it may load further data.

## Asset globs

Globs support the two forms games actually use — `dir/**/*` and `dir/*.ext`. `**` crosses
directories, `*` does not. Files under `src/`, `game.config.json` and `index.html` are never treated
as assets, even if a broad glob would match them.

Asset ids are derived from the path with the `assets/` and `public/` roots stripped:
`assets/sprites/player idle.png` → `sprites-player-idle`. Two files producing the same id is a build
error, not a silent overwrite.

A file that matches no declared glob is reported as a warning (with the list), so an asset cannot
fail to ship quietly.

## What a build produces

```text
dist/
├── index.html          runtime shell (title, size, clear colour, CSP)
├── engine.js           runtime + engine entry
├── game.js             the game module, imported dynamically by the runtime
├── chunk-<hash>.js     shared engine code (imported by both bundles)
├── runtime.css         shell styling
├── game.json           build metadata the runtime reads at boot
├── manifest.json       asset ids, paths, sha256 hashes and sizes
├── build-report.json   status, timings, bundles, outputs, errors, warnings
└── assets/…            the declared assets, copied verbatim
```

The runtime loads `engine.js`; `bootstrap.ts` reads `game.json` and dynamically imports `./game.js`.
esbuild's code splitting means both entries share one engine chunk, so there is exactly one engine
instance — a dynamic import that re-bundled the engine would create two, and `instanceof` checks
across the boundary would start failing.

## Commands

```bash
npm run game:create -- my-game          # scaffold a project that builds immediately
npm run game:validate                   # config, entry, assets, scene references
npm run game:build -- games/my-game     # build one project
npm run games:build                     # build every project and refresh portal/data/games.json
npm run game:dev -- games/my-game       # build, serve, rebuild on change
npm run game:smoke                      # smoke-test the built example in a real browser window
```

## Build reports

`build-report.json` is written on success and returned (in memory) on failure, so the portal can
always say *why* a build did not happen:

```json
{
  "gameId": "hello-render",
  "status": "success",
  "durationMs": 564,
  "assetCount": 1,
  "outputBytes": 86194,
  "bundles": [{ "file": "chunk-2TEFNC7X.js", "bytes": 69000 }],
  "outputs": [{ "file": "index.html", "bytes": 1417, "kind": "html" }],
  "errors": [],
  "warnings": []
}
```
