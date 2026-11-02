import {
  Camera,
  Color,
  Engine,
  Scene,
  Script,
  Sprite,
  Texture,
  Transform,
  Vector2,
  rect,
  ring,
} from '@gameforge/engine';
import type { Game, World } from '@gameforge/engine';

/**
 * Hello Render - the milestone 1 acceptance example.
 *
 * It exercises the pieces that must work before anything else can be built on them:
 *
 *  - a scene containing entities with Transform + Sprite components
 *  - a texture loaded through the asset manifest (and a graceful fallback when it is missing)
 *  - a Script driving movement, so ScriptSystem's lifecycle is covered
 *  - a Camera that follows the scripted entity
 *  - primitive draws queued in the render phase
 *  - the debug overlay
 *
 * Everything here is engine API only - no canvas calls, no DOM access.
 */

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

/** Moves its entity along a Lissajous path and tints it over time. */
class OrbitScript extends Script {
  static override readonly componentName = 'OrbitScript';

  elapsed = 0;
  radiusX = 240;
  radiusY = 110;
  speed = 1.1;

  override onUpdate(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

    const transform = this.getComponent(Transform);
    const sprite = this.getComponent(Sprite);
    if (!transform) return;

    transform.setPosition(
      Math.cos(this.elapsed * this.speed) * this.radiusX,
      Math.sin(this.elapsed * this.speed * 1.7) * this.radiusY,
    );
    // A gentle spin proves rotation reaches the renderer.
    transform.setRotation(Math.sin(this.elapsed * 0.8) * 0.35);

    if (sprite) {
      const pulse = 0.85 + Math.sin(this.elapsed * 2) * 0.15;
      sprite.color.set(pulse, 0.72, 1);
    }
  }
}

/** Draws the reference overlays; a render-phase system rather than an update-phase one. */
function addOverlaySystem(world: World, engine: Engine): void {
  world.addSystem({
    name: 'hello-render/overlay',
    priority: 0,
    render(renderWorld) {
      const queue = renderWorld.renderQueue;
      // Centre crossing lines.
      queue.add(rect(-CANVAS_WIDTH, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 2, 1, '#1b2540'));
      queue.add(rect(CANVAS_WIDTH / 2, -CANVAS_HEIGHT, 1, CANVAS_HEIGHT * 2, '#1b2540'));

      // A ring marking the orbit's outer extent.
      queue.add(ring({ x: 0, y: 0, radius: 240, color: '#233055', lineWidth: 2 }));

      // Debug markers are only collected when debug draw is enabled.
      engine.debugDraw.circle(0, 0, 240, Color.fromHex('#6ea8ff'));
    },
  });
}

export const game: Game = {
  name: 'Hello Render',

  async setup(engine: Engine) {
    const scene = new Scene('main', { description: 'Milestone 1 acceptance scene' });
    engine.world.addScene(scene);
    engine.world.setActiveScene(scene);

    // The texture is declared in game.config.json -> assets/**/* and hashed into manifest.json.
    // `get` is synchronous because the runtime preloads the manifest before setup runs.
    const playerTexture = engine.assets.get<Texture>('player');
    engine.logger.info(playerTexture
      ? `player texture ready (${playerTexture.width}x${playerTexture.height})`
      : 'player texture unavailable - drawing untextured sprites');

    // The camera is itself an entity, so it can be inspected and replaced like anything else.
    const cameraEntity = engine.world.spawn(new Transform(new Vector2(0, 0)), new Camera(new Vector2(0, 0)));
    const camera = cameraEntity.get(Camera);
    if (camera) camera.setViewport(CANVAS_WIDTH, CANVAS_HEIGHT);

    const orbiter = engine.world.spawn(
      new Transform(new Vector2(240, 0)),
      new Sprite({
        width: 96,
        height: 96,
        texture: playerTexture ?? null,
        color: playerTexture ? Color.WHITE : Color.fromHex('#6ea8ff'),
        layer: 10,
      }),
      new OrbitScript(),
    );

    // A static row of tinted markers, drawn behind the orbiter.
    for (let index = 0; index < 6; index += 1) {
      const x = -CANVAS_WIDTH / 2 + 120 + index * 140;
      engine.world.spawn(
        new Transform(new Vector2(x, CANVAS_HEIGHT / 2 - 70)),
        new Sprite({
          width: 54,
          height: 54,
          // Deliberately untextured: a tint multiplied by the blue sprite texture would hide the
          // colour, and this row exists to make the tint parameter visible.
          color: Color.fromHex(index % 2 === 0 ? '#4ed6b8' : '#b78cff'),
          opacity: 0.75,
          layer: 5,
        }),
      );
    }

    const orbiterTransform = orbiter.get(Transform);
    if (camera && orbiterTransform) {
      // Smooth follow, so the camera demonstrates the smoothing path rather than a hard snap.
      camera.follow(orbiterTransform, { smoothing: 3 });
    }

    addOverlaySystem(engine.world, engine);

    engine.logger.info(`scene ready with ${engine.world.entityCount} entities`);
  },

  teardown(engine: Engine) {
    engine.logger.info('hello-render stopped');
  },
};

export default game;
