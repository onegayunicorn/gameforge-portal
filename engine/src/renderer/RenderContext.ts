import type { Color } from '../math/Color';
import type { Material, BlendMode } from './Material';

/** Fields common to every draw command; `layer` drives sort order, `alpha` multiplies opacity. */
export interface DrawCommandBase {
  /** Render layer: lower values draw first (further back). */
  layer: number;
  /** Extra alpha multiplier applied on top of the material opacity. */
  alpha: number;
  blend: BlendMode;
}

export interface QuadCommand extends DrawCommandBase {
  kind: 'quad';
  /** Centre-left origin position in world space (the pivot shifts the draw). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pivot in pixels from the quad's top-left corner. */
  originX: number;
  originY: number;
  rotation: number;
  material: Material;
  flipX: boolean;
  flipY: boolean;
}

export interface CircleCommand extends DrawCommandBase {
  kind: 'circle';
  x: number;
  y: number;
  radius: number;
  color: Color;
  /** Filled circles ignore `lineWidth`. */
  filled: boolean;
  lineWidth: number;
}

export interface LineCommand extends DrawCommandBase {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: Color;
  width: number;
}

export type DrawCommand = QuadCommand | CircleCommand | LineCommand;

/** Per-frame renderer counters, surfaced by the profiler and the portal's runtime panel. */
export interface RenderStats {
  frames: number;
  drawCalls: number;
  quads: number;
  circles: number;
  lines: number;
  layers: number;
  /** Milliseconds spent inside the last frame's draw pass. */
  drawTimeMs: number;
}

export function createRenderStats(): RenderStats {
  return { frames: 0, drawCalls: 0, quads: 0, circles: 0, lines: 0, layers: 0, drawTimeMs: 0 };
}

export function resetRenderStats(stats: RenderStats): void {
  stats.drawCalls = 0;
  stats.quads = 0;
  stats.circles = 0;
  stats.lines = 0;
  stats.layers = 0;
  stats.drawTimeMs = 0;
}
