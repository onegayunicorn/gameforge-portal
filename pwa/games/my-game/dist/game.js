import {
  Color,
  Scene,
  Sprite,
  Transform,
  Vector2,
  rect
} from "./chunk-H2D4S5XG.js";

// games/my-game/src/main.ts
var game = {
  name: "My Game",
  async setup(engine) {
    const scene = new Scene("main");
    engine.world.addScene(scene);
    engine.world.setActiveScene(scene);
    const marker = engine.world.spawn(
      new Transform(new Vector2(640, 360)),
      new Sprite({ width: 96, height: 96, color: Color.fromHex("#6ea8ff") })
    );
    const transform = marker.get(Transform);
    const sprite = marker.get(Sprite);
    let elapsed = 0;
    engine.world.addSystem({
      name: "my-game-update",
      priority: 0,
      update(_world, delta) {
        elapsed += delta;
        if (!transform || !sprite) return;
        transform.setPosition(
          640 + Math.cos(elapsed * 1.2) * 220,
          360 + Math.sin(elapsed * 1.8) * 120
        );
        sprite.color.set(0.43 + Math.sin(elapsed) * 0.2, 0.66, 1);
      }
    });
    engine.world.addSystem({
      name: "my-game-grid",
      priority: 0,
      render(world) {
        world.renderQueue.add(rect(0, 360, 1280, 1, "#1d2740"));
        world.renderQueue.add(rect(640, 0, 1, 720, "#1d2740"));
      }
    });
  }
};
var main_default = game;
export {
  main_default as default,
  game
};
//# sourceMappingURL=game.js.map
