import fs from 'node:fs';
import path from 'node:path';

export interface CreateCommandOptions {
  repoRoot: string;
  id: string;
  /** Target directory. Defaults to `<repoRoot>/games/<id>`. */
  targetDir?: string;
  name?: string;
  width?: number;
  height?: number;
  /** Copy from an existing project instead of the built-in template. */
  from?: string;
}

function kebab(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleCase(id: string): string {
  return id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

/**
 * `gameforge create <id> [--name "Title"] [--width 1280] [--height 720] [--from path]`
 *
 * Generates a project that builds and runs immediately: a config, an entry module that renders a
 * moving rectangle, and an assets folder. The generated entry deliberately uses no assets so the
 * first build cannot fail for environmental reasons.
 */
export async function runCreate(options: CreateCommandOptions): Promise<number> {
  const id = kebab(options.id);
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(id)) {
    console.error(`Invalid id "${options.id}". Use lowercase kebab-case (letters, digits, dashes), 2-63 characters.`);
    return 1;
  }

  const targetDir = path.resolve(options.targetDir ?? path.join(options.repoRoot, 'games', id));
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(`Refusing to overwrite ${targetDir}: it already exists and is not empty.`);
    return 1;
  }

  const name = options.name ?? titleCase(id);
  const width = options.width ?? 1280;
  const height = options.height ?? 720;

  if (options.from) {
    const source = path.resolve(options.from);
    if (!fs.existsSync(source)) {
      console.error(`Template project ${source} does not exist.`);
      return 1;
    }
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(source, targetDir, { recursive: true });
    const configPath = path.join(targetDir, 'game.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.id = id;
    config.name = name;
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`Created ${id} from ${path.relative(options.repoRoot, source)} at ${path.relative(options.repoRoot, targetDir)}`);
    return 0;
  }

  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'assets', '.gitkeep'), '');

  fs.writeFileSync(path.join(targetDir, 'game.config.json'), `${JSON.stringify({
    $schema: '../../tools/schemas/game-config.schema.json',
    id,
    name,
    description: `A GameForge game created by the CLI.`,
    version: '0.1.0',
    engine: '^0.1.0',
    entry: 'src/main.ts',
    type: '2d',
    renderer: 'auto',
    width,
    height,
    clearColor: '#0b1020',
    scenes: [],
    assets: ['assets/**/*'],
    scripts: { dev: 'gameforge dev', build: 'gameforge build' },
    tags: [],
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(targetDir, 'src', 'main.ts'), `import { Color, Engine, Scene, Sprite, Transform, Vector2, rect } from '@gameforge/engine';
import type { Game } from '@gameforge/engine';

/**
 * ${name}
 *
 * A minimal starting point: one entity with a Sprite and a Transform, moved by a small update loop.
 * Replace the body of \`update\` with your own game logic.
 */
export const game: Game = {
  name: '${name}',

  async setup(engine: Engine) {
    const scene = new Scene('main');
    engine.world.addScene(scene);
    engine.world.setActiveScene(scene);

    // A visible reference object so the canvas is never empty while you build.
    const marker = engine.world.spawn(
      new Transform(new Vector2(${Math.round(width / 2)}, ${Math.round(height / 2)})),
      new Sprite({ width: 96, height: 96, color: Color.fromHex('#6ea8ff') }),
    );

    const transform = marker.get(Transform);
    const sprite = marker.get(Sprite);

    let elapsed = 0;
    engine.world.addSystem({
      name: '${id}-update',
      priority: 0,
      update(_world, delta) {
        elapsed += delta;
        if (!transform || !sprite) return;
        transform.setPosition(
          ${Math.round(width / 2)} + Math.cos(elapsed * 1.2) * 220,
          ${Math.round(height / 2)} + Math.sin(elapsed * 1.8) * 120,
        );
        sprite.color.set(0.43 + Math.sin(elapsed) * 0.2, 0.66, 1);
      },
    });

    // Demonstrates the primitive helpers; remove when you draw your own content.
    engine.world.addSystem({
      name: '${id}-grid',
      priority: 0,
      render(world) {
        world.renderQueue.add(rect(0, ${Math.round(height / 2)}, ${width}, 1, '#1d2740'));
        world.renderQueue.add(rect(${Math.round(width / 2)}, 0, 1, ${height}, '#1d2740'));
      },
    });
  },
};

export default game;
`);

  console.log(`Created ${id} at ${path.relative(options.repoRoot, targetDir)}`);
  console.log(`Next: npm run game:build -- ${path.relative(options.repoRoot, targetDir)}`);
  return 0;
}
