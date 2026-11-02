(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GameForgeStudioValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  'use strict';

  const COLOR = /^#[0-9a-fA-F]{6}$/;
  const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

  function validateStudioPayload(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, errors: ['Output must be a JSON object.'] };
    }
    const sim = payload.sim;
    const typescript = payload.typescript;
    if (!sim || typeof sim !== 'object' || Array.isArray(sim)) {
      errors.push('sim must be an object.');
    }
    if (typeof typescript !== 'string' || typescript.length < 1 || typescript.length > 30000) {
      errors.push('typescript must be a non-empty string of at most 30,000 characters.');
    }
    if (!sim || typeof sim !== 'object' || Array.isArray(sim)) return { ok: false, errors };

    if (typeof sim.title !== 'string' || sim.title.length < 1 || sim.title.length > 100) errors.push('sim.title must be 1–100 characters.');
    if (typeof sim.description !== 'string' || sim.description.length > 500) errors.push('sim.description must be at most 500 characters.');
    const world = sim.world;
    if (!world || typeof world !== 'object' || Array.isArray(world)) {
      errors.push('sim.world must be an object.');
    } else {
      if (!finite(world.width, 240, 1600)) errors.push('world.width must be between 240 and 1,600.');
      if (!finite(world.height, 180, 1000)) errors.push('world.height must be between 180 and 1,000.');
      if (!finite(world.gravityY, -1500, 1500)) errors.push('world.gravityY must be between -1,500 and 1,500.');
      if (!finite(world.restitution, 0, 1)) errors.push('world.restitution must be between 0 and 1.');
      if (typeof world.background !== 'string' || !COLOR.test(world.background)) errors.push('world.background must be a six-digit hex color.');
    }

    if (!Array.isArray(sim.entities) || sim.entities.length > 32) {
      errors.push('sim.entities must be an array containing no more than 32 entities.');
    } else {
      sim.entities.forEach((entity, index) => {
        const prefix = `entities[${index}]`;
        if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
          errors.push(`${prefix} must be an object.`);
          return;
        }
        if (!['circle', 'rect'].includes(entity.type)) errors.push(`${prefix}.type must be circle or rect.`);
        if (!finite(entity.x, -100, 1700) || !finite(entity.y, -100, 1100)) errors.push(`${prefix} position is outside the supported range.`);
        if (!finite(entity.vx, -1000, 1000) || !finite(entity.vy, -1000, 1000)) errors.push(`${prefix} velocity is outside the supported range.`);
        if (typeof entity.color !== 'string' || !COLOR.test(entity.color)) errors.push(`${prefix}.color must be a six-digit hex color.`);
        if (entity.static !== undefined && typeof entity.static !== 'boolean') errors.push(`${prefix}.static must be a boolean when provided.`);
        if (entity.type === 'circle' && !finite(entity.radius, 2, 100)) errors.push(`${prefix}.radius must be between 2 and 100.`);
        if (entity.type === 'rect' && (!finite(entity.width, 4, 500) || !finite(entity.height, 4, 300))) errors.push(`${prefix} rectangle dimensions are outside the supported range.`);
      });
    }

    if (sim.rope !== null) {
      const rope = sim.rope;
      if (!rope || typeof rope !== 'object' || Array.isArray(rope)) {
        errors.push('sim.rope must be null or an object.');
      } else {
        if (!finite(rope.anchorX, 0, 1600) || !finite(rope.anchorY, 0, 1000)) errors.push('rope anchor is outside the supported range.');
        if (!Number.isInteger(rope.segments) || rope.segments < 2 || rope.segments > 48) errors.push('rope.segments must be an integer from 2 to 48.');
        if (!finite(rope.length, 8, 800)) errors.push('rope.length must be between 8 and 800.');
        if (!finite(rope.stiffness, 0, 1)) errors.push('rope.stiffness must be between 0 and 1.');
        if (typeof rope.color !== 'string' || !COLOR.test(rope.color)) errors.push('rope.color must be a six-digit hex color.');
      }
    }
    return { ok: errors.length === 0, errors, sim, typescript };
  }

  function starterScene(kind) {
    const scenes = {
      rope: {
        sim: {
          title: 'Elastic rope', description: 'A bob suspended from a fixed anchor.',
          world: { width: 960, height: 540, gravityY: 540, restitution: 0.72, background: '#0b1324' },
          entities: [{ type: 'circle', x: 485, y: 350, vx: 95, vy: 0, radius: 25, color: '#ffbf69' }],
          rope: { anchorX: 480, anchorY: 62, segments: 14, length: 310, stiffness: 0.64, color: '#8bd0ff' },
        },
        typescript: 'export function update(ctx: GameForgeContext, dt: number): void {\n  // Add bounded Canvas2D updates here. Generated code is shown as text and is not executed by Studio.\n  ctx.drawLine({ x1: 480, y1: 62, x2: 485, y2: 350, color: "#8bd0ff" });\n}\n',
      },
      bouncer: {
        sim: {
          title: 'Bouncy room', description: 'Colored bodies falling and bouncing inside a Canvas2D world.',
          world: { width: 960, height: 540, gravityY: 460, restitution: 0.84, background: '#10192b' },
          entities: [
            { type: 'circle', x: 190, y: 120, vx: 96, vy: 0, radius: 27, color: '#6ea8ff' },
            { type: 'circle', x: 430, y: 80, vx: -60, vy: 25, radius: 34, color: '#b78cff' },
            { type: 'rect', x: 650, y: 110, vx: 45, vy: 0, width: 82, height: 50, color: '#4ed6b8' },
          ],
          rope: null,
        },
        typescript: 'export function update(ctx: GameForgeContext, dt: number): void {\n  // Apply bounded motion with the world gravity and restitution settings.\n  ctx.integrateBodies(dt);\n}\n',
      },
      platform: {
        sim: {
          title: 'Platform starter', description: 'A player-sized body above two platforms.',
          world: { width: 960, height: 540, gravityY: 650, restitution: 0.18, background: '#111a27' },
          entities: [
            { type: 'rect', x: 120, y: 410, vx: 0, vy: 0, width: 340, height: 24, color: '#4ed6b8', static: true },
            { type: 'rect', x: 590, y: 310, vx: 0, vy: 0, width: 245, height: 24, color: '#6ea8ff', static: true },
            { type: 'circle', x: 205, y: 360, vx: 0, vy: 0, radius: 19, color: '#ffbf69' },
          ],
          rope: null,
        },
        typescript: 'export function update(ctx: GameForgeContext, dt: number): void {\n  // Add player input and platform collision behavior here.\n  ctx.resolvePlatformContacts();\n}\n',
      },
    };
    const selected = scenes[kind] || scenes.rope;
    return JSON.parse(JSON.stringify(selected));
  }

  return { validateStudioPayload, starterScene };
});
