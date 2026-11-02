# Core Rush implementation plan

## Product
Add a flagship first-play game to GameForge Portal: **Core Rush**, a 60-second neon survival arcade game designed to convert portal visitors into repeat players.

## Implementation approach
- Add a new GameForge Engine project at `games/featured/core-rush` using the existing 2D Canvas2D pipeline.
- Keep the gameplay dependency-free and deterministic: keyboard movement, dash, collectible cores, pursuing sentinels, health, combo multiplier, score, timer, restart, and victory/game-over states.
- Render with the engine's supported primitives only so the build works in browser, Electron, and headless validation without DOM access.
- Generate `portal/data/games.json` through the existing build/index script so the game is measured as runnable and appears in the local portal Games section.
- Add the built game to `portal/cloud/data/games.json` as the featured instant-play title for the public-facing Cloud Play library.

## Design
### Style options
- **Neon arcade telemetry** (0.06): dense cyan/violet HUD energy, grid pulse, and sharp readable silhouettes.
- **Solar punk arena** (0.03): warm gold, mint, and dark stone with an optimistic expedition tone.
- **Mono industrial survival** (0.08): restrained amber/charcoal instrumentation and hard-edged hazard warnings.

### Chosen direction: Neon arcade telemetry
- **Design Movement:** 1980s arcade cabinet language fused with modern sci-fi telemetry UI.
- **Core Principles:** immediate readability, high-contrast motion, meaningful risk/reward, and satisfying repeatable mastery.
- **Color Philosophy:** cyan is player agency, violet is collectible opportunity, amber is danger, and deep navy gives every signal room to glow.
- **Layout Paradigm:** a centered playfield framed by telemetry rails; the arena is open and spacious while the HUD hugs the perimeter rather than covering play.
- **Signature Elements:** scanline/grid floor, concentric target rings, and bright shard pickups that pulse like forge sparks.
- **Interaction Philosophy:** movement is always available; Space converts danger into agency through a short dash; collecting shards increases the combo, so confident routing beats passive survival.
- **Animation:** breathing grid, rotating pickup rings, accelerating enemy drift, dash streaks, and a visible escalation as the timer advances.
- **Typography System:** engine/runtime defaults remain unchanged; portal copy uses the existing GameForge system and concise arcade-style labels.
- **Brand Essence:** GameForge is the place where a build becomes something you can play immediately—bold, technical, inviting. Personality: kinetic, precise, generous.
- **Brand Voice:** short, confident, player-first. Example lines: “Forge a higher score.” / “One minute. One core. No excuses.”
- **Wordmark & Logo:** retain the portal's faceted hex mark; Core Rush is represented in-game by a glowing core inside a targeting reticle.
- **Signature Brand Color:** GameForge cyan `#6ea8ff`, paired with forge violet `#b78cff`.

## Project structure
- `games/featured/core-rush/game.config.json`: engine/build metadata and portal tags.
- `games/featured/core-rush/src/main.ts`: game state, update loop, input, collision, and primitive rendering.
- `portal/data/games.json`: generated local portal index.
- `portal/cloud/data/games.json`: curated public Cloud Play catalog entry.

## Constraints
Reuse the current engine and scripts. Do not introduce a second frontend stack or external runtime dependency. The result must pass the existing build, validation, and Electron smoke test conventions.
