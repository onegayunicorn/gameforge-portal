import { Color, Engine, Scene, Sprite, Transform, Vector2, rect } from '@gameforge/engine';
import type { Game } from '@gameforge/engine';

/**
 * My Game
 *
 * A minimal starting point: one entity with a Sprite and a Transform, moved by a small update loop.
 * Replace the body of `update` with your own game logic.
 */
export const game: Game = {
  name: 'My Game',

  async setup(engine: Engine) {
    const scene = new Scene('main');
    engine.world.addScene(scene);
    engine.world.setActiveScene(scene);

    // A visible reference object so the canvas is never empty while you build.
    const marker = engine.world.spawn(
      new Transform(new Vector2(640, 360)),
      new Sprite({ width: 96, height: 96, color: Color.fromHex('#6ea8ff') }),
    );

    const transform = marker.get(Transform);
    const sprite = marker.get(Sprite);

    let elapsed = 0;
    engine.world.addSystem({
      name: 'my-game-update',
      priority: 0,
      update(_world, delta) {
        elapsed += delta;
        if (!transform || !sprite) return;
        transform.setPosition(
          640 + Math.cos(elapsed * 1.2) * 220,
          360 + Math.sin(elapsed * 1.8) * 120,
        );
        sprite.color.set(0.43 + Math.sin(elapsed) * 0.2, 0.66, 1);
      },
    });

    // Demonstrates the primitive helpers; remove when you draw your own content.
    engine.world.addSystem({
      name: 'my-game-grid',
      priority: 0,
      render(world) {
        world.renderQueue.add(rect(0, 360, 1280, 1, '#1d2740'));
        world.renderQueue.add(rect(640, 0, 1, 720, '#1d2740'));
      },
    });
  },
};

export default game;
