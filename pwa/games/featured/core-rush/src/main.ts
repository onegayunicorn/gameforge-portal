import {
  Camera,
  Scene,
  Transform,
  Vector2,
  circle,
  line,
  rect,
  ring,
} from '@gameforge/engine';
import type { Game, World } from '@gameforge/engine';

const WIDTH = 960;
const HEIGHT = 540;
const ARENA = { left: -420, right: 420, top: -184, bottom: 184 };
const GOAL_SECONDS = 60;

type Point = { x: number; y: number; phase: number; hue: 'violet' | 'cyan' };
type Sentinel = Point & { speed: number; size: number };

type RushState = {
  player: Point & { hp: number; dash: number; invuln: number };
  cores: Point[];
  sentinels: Sentinel[];
  elapsed: number;
  score: number;
  combo: number;
  bestCombo: number;
  phase: 'playing' | 'victory' | 'gameover';
  pulse: number;
  dashFlash: number;
  shake: number;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const inputDown = (world: World, code: string) => Boolean(world.services.input?.isKeyDown(code));
const pressed = (world: World, code: string) => Boolean(world.services.input?.wasKeyPressed(code));

function makeCore(index: number): Point {
  const angle = index * 2.399963 + 0.35;
  const radius = 70 + (index % 4) * 52;
  return {
    x: Math.cos(angle) * radius * 1.65,
    y: Math.sin(angle) * radius,
    phase: index * 0.7,
    hue: index % 3 === 0 ? 'cyan' : 'violet',
  };
}

function makeSentinel(index: number, elapsed = 0): Sentinel {
  const angle = index * 1.71 + 0.8;
  const radius = 255 + (index % 3) * 35;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.62,
    phase: index * 0.9,
    hue: 'cyan',
    speed: 28 + index * 3 + elapsed * 0.18,
    size: 12 + (index % 2) * 4,
  };
}

function freshState(): RushState {
  return {
    player: { x: 0, y: 0, phase: 0, hue: 'cyan', hp: 100, dash: 0, invuln: 0 },
    cores: Array.from({ length: 7 }, (_, index) => makeCore(index)),
    sentinels: Array.from({ length: 5 }, (_, index) => makeSentinel(index)),
    elapsed: 0,
    score: 0,
    combo: 1,
    bestCombo: 1,
    phase: 'playing',
    pulse: 0,
    dashFlash: 0,
    shake: 0,
  };
}

function addArena(world: World, state: RushState): void {
  world.addSystem({
    name: 'core-rush/gameplay',
    priority: 0,
    update(currentWorld, delta) {
      if (state.phase !== 'playing') {
        if (pressed(currentWorld, 'KeyR')) Object.assign(state, freshState());
        return;
      }

      state.elapsed += delta;
      state.pulse += delta;
      state.player.dash = Math.max(0, state.player.dash - delta);
      state.player.invuln = Math.max(0, state.player.invuln - delta);
      state.dashFlash = Math.max(0, state.dashFlash - delta);
      state.shake = Math.max(0, state.shake - delta);

      let dx = 0;
      let dy = 0;
      if (inputDown(currentWorld, 'ArrowLeft') || inputDown(currentWorld, 'KeyA')) dx -= 1;
      if (inputDown(currentWorld, 'ArrowRight') || inputDown(currentWorld, 'KeyD')) dx += 1;
      if (inputDown(currentWorld, 'ArrowUp') || inputDown(currentWorld, 'KeyW')) dy -= 1;
      if (inputDown(currentWorld, 'ArrowDown') || inputDown(currentWorld, 'KeyS')) dy += 1;
      const magnitude = Math.hypot(dx, dy) || 1;
      const moving = dx !== 0 || dy !== 0;
      const speed = 190 + Math.min(85, state.elapsed * 1.1);

      if (pressed(currentWorld, 'Space') && state.player.dash <= 0) {
        if (!moving) {
          dx = 1;
          dy = 0;
        }
        const dashMagnitude = Math.hypot(dx, dy) || 1;
        state.player.x = clamp(state.player.x + (dx / dashMagnitude) * 105, ARENA.left + 24, ARENA.right - 24);
        state.player.y = clamp(state.player.y + (dy / dashMagnitude) * 105, ARENA.top + 24, ARENA.bottom - 24);
        state.player.dash = 2.4;
        state.player.invuln = 0.38;
        state.dashFlash = 0.35;
        state.shake = 0.16;
      } else if (moving) {
        state.player.x = clamp(state.player.x + (dx / magnitude) * speed * delta, ARENA.left + 20, ARENA.right - 20);
        state.player.y = clamp(state.player.y + (dy / magnitude) * speed * delta, ARENA.top + 20, ARENA.bottom - 20);
      }

      for (const sentinel of state.sentinels) {
        const toPlayerX = state.player.x - sentinel.x;
        const toPlayerY = state.player.y - sentinel.y;
        const length = Math.hypot(toPlayerX, toPlayerY) || 1;
        const drift = sentinel.speed + state.elapsed * 0.9;
        sentinel.x += (toPlayerX / length) * drift * delta;
        sentinel.y += (toPlayerY / length) * drift * delta;
        if (distance(state.player, sentinel) < sentinel.size + 16 && state.player.invuln <= 0) {
          state.player.hp = Math.max(0, state.player.hp - 18);
          state.player.invuln = 0.9;
          state.combo = 1;
          state.shake = 0.28;
          sentinel.x -= (toPlayerX / length) * 38;
          sentinel.y -= (toPlayerY / length) * 38;
        }
      }

      state.cores.forEach((core, index) => {
        core.phase += delta * 2.4;
        if (distance(state.player, core) < 21) {
          state.score += 100 * state.combo;
          state.combo = Math.min(9, state.combo + 1);
          state.bestCombo = Math.max(state.bestCombo, state.combo);
          state.player.hp = Math.min(100, state.player.hp + 3);
          const replacement = makeCore(index + Math.floor(state.elapsed * 3) + 5);
          core.x = replacement.x + Math.sin(state.elapsed + index) * 36;
          core.y = replacement.y + Math.cos(state.elapsed * 0.7 + index) * 22;
          core.phase = replacement.phase;
          core.hue = replacement.hue;
        }
      });

      const wave = Math.floor(state.elapsed / 12);
      while (state.sentinels.length < Math.min(11, 5 + wave)) {
        state.sentinels.push(makeSentinel(state.sentinels.length + wave, state.elapsed));
      }
      if (state.player.hp <= 0) state.phase = 'gameover';
      if (state.elapsed >= GOAL_SECONDS) state.phase = 'victory';
    },
  });
}

function addRenderer(world: World, state: RushState): void {
  world.addSystem({
    name: 'core-rush/render',
    priority: 10,
    render(currentWorld) {
      const queue = currentWorld.renderQueue;
      const pulse = (Math.sin(state.pulse * 2.1) + 1) * 0.5;
      const shakeX = state.shake > 0 ? Math.sin(state.pulse * 60) * state.shake * 8 : 0;
      const shakeY = state.shake > 0 ? Math.cos(state.pulse * 53) * state.shake * 6 : 0;
      const timeRatio = clamp(state.elapsed / GOAL_SECONDS, 0, 1);

      queue.add(rect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, '#070a16', -20));
      queue.add(rect(ARENA.left - 14, ARENA.top - 14, ARENA.right - ARENA.left + 28, ARENA.bottom - ARENA.top + 28, '#0b1020', -10));
      for (let x = ARENA.left; x <= ARENA.right; x += 42) {
        queue.add(line({ x1: x, y1: ARENA.top, x2: x, y2: ARENA.bottom, color: '#142340', alpha: 0.48, width: 1, layer: -5 }));
      }
      for (let y = ARENA.top; y <= ARENA.bottom; y += 42) {
        queue.add(line({ x1: ARENA.left, y1: y, x2: ARENA.right, y2: y, color: '#142340', alpha: 0.48, width: 1, layer: -5 }));
      }
      queue.add(ring({ x: 0, y: 0, radius: 90 + pulse * 6, color: '#1d3962', alpha: 0.65, lineWidth: 1, layer: -2 }));
      queue.add(ring({ x: 0, y: 0, radius: 248 + pulse * 8, color: '#172f53', alpha: 0.55, lineWidth: 1, layer: -2 }));
      queue.add(rect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, 3, '#6ea8ff', 0));
      queue.add(rect(ARENA.left, ARENA.bottom - 3, ARENA.right - ARENA.left, 3, '#6ea8ff', 0));
      queue.add(rect(ARENA.left, ARENA.top, 3, ARENA.bottom - ARENA.top, '#6ea8ff', 0));
      queue.add(rect(ARENA.right - 3, ARENA.top, 3, ARENA.bottom - ARENA.top, '#6ea8ff', 0));

      // Top telemetry rail: health, countdown, and combo are encoded as distinct signal bands.
      queue.add(rect(-420, -255, 260, 8, '#17233c', 1));
      queue.add(rect(-420, -255, 260 * (state.player.hp / 100), 8, state.player.hp > 35 ? '#4ed6b8' : '#ff7d8a', 2));
      queue.add(rect(-130, -255, 260, 8, '#17233c', 1));
      queue.add(rect(-130, -255, 260 * (1 - timeRatio), 8, '#b78cff', 2));
      queue.add(rect(160, -255, 260, 8, '#17233c', 1));
      queue.add(rect(160, -255, 260 * (state.combo / 9), 8, '#6ea8ff', 2));
      for (let i = 0; i < 10; i += 1) {
        queue.add(rect(-420 + i * 84, 226, 56, 3, i < Math.ceil(state.score / 300) % 10 ? '#b78cff' : '#16233b', 1));
      }

      for (const core of state.cores) {
        const coreColor = core.hue === 'cyan' ? '#6ea8ff' : '#b78cff';
        const glow = 10 + Math.sin(core.phase) * 2;
        queue.add(ring({ x: core.x + shakeX, y: core.y + shakeY, radius: glow + 5, color: coreColor, alpha: 0.22, lineWidth: 3, layer: 4 }));
        queue.add(circle({ x: core.x + shakeX, y: core.y + shakeY, radius: 5 + pulse * 1.5, color: coreColor, layer: 5 }));
        queue.add(line({ x1: core.x - 10 + shakeX, y1: core.y + shakeY, x2: core.x + 10 + shakeX, y2: core.y + shakeY, color: coreColor, alpha: 0.55, width: 1, layer: 5 }));
      }

      for (const sentinel of state.sentinels) {
        const danger = Math.min(1, state.elapsed / 45);
        const color = danger > 0.65 ? '#ff7d8a' : '#ffc46b';
        queue.add(ring({ x: sentinel.x + shakeX, y: sentinel.y + shakeY, radius: sentinel.size + 8 + pulse * 2, color, alpha: 0.24, lineWidth: 2, layer: 6 }));
        queue.add(circle({ x: sentinel.x + shakeX, y: sentinel.y + shakeY, radius: sentinel.size, color, layer: 7 }));
        queue.add(circle({ x: sentinel.x + shakeX, y: sentinel.y + shakeY, radius: 4, color: '#1b1325', layer: 8 }));
      }

      const playerColor = state.player.invuln > 0 ? '#ffffff' : '#4ed6b8';
      if (state.dashFlash > 0) queue.add(ring({ x: state.player.x, y: state.player.y, radius: 34 + state.dashFlash * 50, color: '#6ea8ff', alpha: state.dashFlash * 1.7, lineWidth: 4, layer: 10 }));
      queue.add(ring({ x: state.player.x + shakeX, y: state.player.y + shakeY, radius: 23 + pulse * 2, color: playerColor, alpha: 0.8, lineWidth: 2, layer: 10 }));
      queue.add(circle({ x: state.player.x + shakeX, y: state.player.y + shakeY, radius: 12, color: playerColor, layer: 11 }));
      queue.add(circle({ x: state.player.x + shakeX, y: state.player.y + shakeY, radius: 5, color: '#07141b', layer: 12 }));
      queue.add(line({ x1: state.player.x - 28 + shakeX, y1: state.player.y + shakeY, x2: state.player.x + 28 + shakeX, y2: state.player.y + shakeY, color: playerColor, alpha: 0.5, width: 1, layer: 10 }));
      queue.add(line({ x1: state.player.x + shakeX, y1: state.player.y - 28 + shakeY, x2: state.player.x + shakeX, y2: state.player.y + 28 + shakeY, color: playerColor, alpha: 0.5, width: 1, layer: 10 }));

      // State is communicated visually even on a clean canvas with no DOM overlay.
      if (state.phase !== 'playing') {
        queue.add(rect(-188, -48, 376, 96, state.phase === 'victory' ? '#102c31' : '#311923', 20));
        queue.add(ring({ x: 0, y: 0, radius: state.phase === 'victory' ? 38 + pulse * 5 : 32, color: state.phase === 'victory' ? '#4ed6b8' : '#ff7d8a', alpha: 0.9, lineWidth: 5, layer: 21 }));
        queue.add(circle({ x: 0, y: 0, radius: 12, color: state.phase === 'victory' ? '#4ed6b8' : '#ff7d8a', layer: 22 }));
        queue.add(line({ x1: -112, y1: 0, x2: -54, y2: 0, color: state.phase === 'victory' ? '#4ed6b8' : '#ff7d8a', width: 3, layer: 21 }));
        queue.add(line({ x1: 54, y1: 0, x2: 112, y2: 0, color: state.phase === 'victory' ? '#4ed6b8' : '#ff7d8a', width: 3, layer: 21 }));
      }
    },
  });
}

export const game: Game = {
  name: 'Core Rush',
  setup(engine) {
    const scene = new Scene('main', { description: 'Core Rush one-minute neon survival arena' });
    engine.world.addScene(scene);
    engine.world.setActiveScene(scene);
    engine.world.spawn(new Transform(new Vector2(0, 0)));
    engine.world.spawn(new Transform(new Vector2(-120, 0)));
    engine.world.spawn(new Transform(new Vector2(120, 0)));
    const cameraEntity = engine.world.spawn(new Transform(new Vector2(0, 0)), new Camera(new Vector2(0, 0)));
    const camera = cameraEntity.get(Camera);
    if (camera) camera.setViewport(WIDTH, HEIGHT);
    const state = freshState();
    addArena(engine.world, state);
    addRenderer(engine.world, state);
    engine.logger.info('Core Rush ready — move with WASD/arrows, Space to dash, R to restart');
  },
};

export default game;
