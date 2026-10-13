import { describe, expect, it, vi } from 'vitest';
import {
  Engine,
  GameLoop,
  HeadlessPlatform,
  Scene,
  Script,
  Sprite,
  Transform,
  Vector2,
  Clock,
} from '@gameforge/engine';
import type { Game, World } from '@gameforge/engine';

/** Moves its entity along +X at a fixed rate, and records how many steps it ran. */
class DriftScript extends Script {
  static override readonly componentName = 'DriftScript';
  steps = 0;
  distance = 0;

  override onUpdate(deltaSeconds: number): void {
    this.steps += 1;
    this.distance += 60 * deltaSeconds;
    this.getComponent(Transform)?.setPosition(this.distance, 0);
  }
}

function createTestGame(): { game: Game; script: DriftScript; spawned: { count: number } } {
  const script = new DriftScript();
  const spawned = { count: 0 };

  const game: Game = {
    name: 'test-game',
    setup(engine: Engine) {
      const scene = new Scene('main');
      engine.world.addScene(scene);
      engine.world.setActiveScene(scene);
      engine.world.spawn(new Transform(new Vector2(0, 0)), new Sprite({ width: 16, height: 16 }), script);
      engine.world.spawn(new Transform(new Vector2(10, 10)), new Sprite({ width: 16, height: 16 }));
      spawned.count = engine.world.entityCount;
    },
  };

  return { game, script, spawned };
}

describe('Engine (headless)', () => {
  it('builds a game, steps deterministically and reports state', async () => {
    const { game, script, spawned } = createTestGame();
    const engine = new Engine({ headless: true, width: 320, height: 240 });

    await engine.start(game);
    expect(engine.isStarted).toBe(true);
    expect(engine.isReady).toBe(true);
    expect(spawned.count).toBe(2);

    engine.advance(60, { render: false });

    // 60 fixed steps of 1/60s at 60 units/second == 60 units travelled.
    expect(script.steps).toBe(60);
    expect(script.distance).toBeCloseTo(60, 5);

    const state = engine.runtimeState();
    expect(state.entities).toBe(2);
    expect(state.activeScene).toBe('main');
    expect(state.backend).toBe('canvas2d');

    await engine.stop();
    expect(engine.isStarted).toBe(false);
    engine.dispose();
  });

  it('produces identical simulation state across two identical runs', async () => {
    const run = async (): Promise<number> => {
      const { game, script } = createTestGame();
      const engine = new Engine({ headless: true, fixedTimeStep: 1 / 60 });
      await engine.start(game);
      engine.advance(120, { render: false });
      const distance = script.distance;
      await engine.stop();
      engine.dispose();
      return distance;
    };

    expect(await run()).toBe(await run());
  });

  it('renders in headless mode and counts draw calls without a canvas', async () => {
    const { game } = createTestGame();
    const engine = new Engine({ headless: true });
    await engine.start(game);
    engine.advance(1, { render: true });

    const metrics = engine.metricsSnapshot;
    expect(metrics.frames).toBeGreaterThan(0);
    expect(metrics.drawCalls).toBeGreaterThanOrEqual(2);
    expect(engine.renderer.capabilities.headless).toBe(true);

    engine.dispose();
  });

  it('runs script lifecycle exactly once per script and tears down on destroy', async () => {
    const started = vi.fn();
    const updated = vi.fn();
    const destroyed = vi.fn();

    class LifecycleScript extends Script {
      override onStart(): void { started(); }
      override onUpdate(): void { updated(); }
      override onDestroy(): void { destroyed(); }
    }

    const engine = new Engine({ headless: true });
    await engine.start({
      setup(world: Engine) {
        const scene = new Scene('main');
        world.world.addScene(scene);
        world.world.setActiveScene(scene);
        world.world.spawn(new Transform(), new LifecycleScript());
      },
    });

    engine.advance(3, { render: false });
    expect(started).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(3);

    engine.world.clear();
    engine.advance(1, { render: false });
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(3);

    engine.dispose();
  });

  it('refuses the unimplemented webgl2 renderer instead of silently degrading', () => {
    // A canvas is supplied so configuration resolves, leaving the renderer choice as the only
    // thing that can fail - which is what this asserts.
    const fakeCanvas = { width: 320, height: 240, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => new Engine({ headless: false, renderer: 'webgl2', canvas: fakeCanvas }))
      .toThrow(/WebGL2 renderer is not implemented yet/i);
  });

  it('requires a canvas when it is not headless', () => {
    expect(() => new Engine({ headless: false, canvas: null }))
      .toThrow(/canvas is required unless headless/i);
  });

  it('validates its configuration', () => {
    expect(() => new Engine({ width: 0 })).toThrow(/width must be > 0/i);
    expect(() => new Engine({ fixedTimeStep: 0 })).toThrow(/fixedTimeStep/i);
  });
});

describe('GameLoop', () => {
  it('runs fixed steps and interpolates between them', () => {
    const updates: number[] = [];
    const renders: number[] = [];
    const loop = new GameLoop(
      { fixedTimeStep: 1 / 60, maxDeltaTime: 1, clock: new Clock(() => 0) },
      {
        update: (delta) => void updates.push(delta),
        render: (alpha) => void renders.push(alpha),
      },
    );

    // A 50ms frame at a 16.67ms step is three steps with a small remainder.
    loop.frame(0.05);
    expect(updates).toHaveLength(3);
    expect(renders).toHaveLength(1);
    expect(renders[0]).toBeGreaterThan(0);

    loop.reset();
    expect(loop.stats.frames).toBe(0);
  });

  it('clamps an enormous delta and drops the backlog instead of spiralling', () => {
    let updates = 0;
    const loop = new GameLoop(
      { fixedTimeStep: 1 / 60, maxDeltaTime: 0.25, maxSubSteps: 5, clock: new Clock(() => 0) },
      { update: () => void (updates += 1), render: () => undefined },
    );

    loop.frame(10);
    expect(updates).toBe(5);
    expect(loop.stats.droppedTime).toBeGreaterThan(0);
  });

  it('advance() is scheduler free and exact', () => {
    let updates = 0;
    const loop = new GameLoop(
      { fixedTimeStep: 1 / 30, clock: new Clock(() => 0) },
      { update: () => void (updates += 1), render: () => undefined },
    );
    loop.advance(7);
    expect(updates).toBe(7);
  });
});

describe('HeadlessPlatform', () => {
  it('drives scheduled frames on demand', () => {
    const platform = new HeadlessPlatform();
    const callback = vi.fn();
    platform.requestFrame(callback);
    expect(callback).not.toHaveBeenCalled();
    platform.advanceFrame(16);
    expect(callback).toHaveBeenCalledWith(16);
    expect(platform.isHeadless).toBe(true);
    expect(platform.info.kind).toBe('headless');
  });
});

describe('World scene scoping', () => {
  it('keeps entities out of a scene that is not active', async () => {
    const engine = new Engine({ headless: true });
    await engine.start({
      setup(world: Engine) {
        const a = new Scene('a');
        const b = new Scene('b');
        world.world.addScene(a);
        world.world.addScene(b);
        world.world.setActiveScene(a);
        world.world.spawn(new Transform());
        world.world.setActiveScene(b);
        world.world.spawn(new Transform());
        world.world.spawn(new Transform());
      },
    });

    expect(engine.world.entityCount).toBe(2);
    expect(engine.world.activeScene?.name).toBe('b');
    expect(engine.world.getScene('a')?.entityCount).toBe(0);
    engine.dispose();
  });
});

describe('System service wiring', () => {
  it('exposes renderer, input, assets and a reference to the engine on the world', async () => {
    const engine = new Engine({ headless: true });
    await engine.start({ setup() { /* no scene required */ } });

    const world: World = engine.world;
    expect(world.services.renderer).toBe(engine.renderer);
    expect(world.services.input).toBe(engine.input);
    expect(world.services.assets).toBe(engine.assets);
    expect(world.services.engine).toBe(engine);
    expect(world.services.platform?.isHeadless).toBe(true);

    engine.dispose();
  });
});
