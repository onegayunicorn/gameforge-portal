export type RendererPreference = 'auto' | 'webgl2' | 'canvas2d';
export type RendererBackend = 'webgl2' | 'canvas2d';

/** Options accepted by `new Engine(...)`. Every field has a working default. */
export interface EngineConfig {
  /** Canvas to render into. Omitted in headless mode. */
  canvas?: HTMLCanvasElement | null;
  /** Logical width in pixels. Defaults to the canvas size, then 1280. */
  width?: number;
  /** Logical height in pixels. Defaults to the canvas size, then 720. */
  height?: number;
  /** Simulation step in seconds. Defaults to 1/60. */
  fixedTimeStep?: number;
  /** Clamp for a single frame delta, in seconds. Defaults to 0.25. */
  maxDeltaTime?: number;
  /** Renderer preference. `auto` currently resolves to canvas2d; webgl2 arrives in milestone 2. */
  renderer?: RendererPreference;
  /** Enables debug draw and verbose logging. */
  debug?: boolean;
  /** Skip the frame scheduler and canvas entirely; simulation is driven by `advance()`. */
  headless?: boolean;
  /** Underlying pixel ratio. Defaults to the platform's devicePixelRatio. */
  pixelRatio?: number;
  /** Target frames per second for manual scheduling; 0 means "as fast as the scheduler allows". */
  targetFps?: number;
}

export interface ResolvedEngineConfig {
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  fixedTimeStep: number;
  maxDeltaTime: number;
  renderer: RendererPreference;
  debug: boolean;
  headless: boolean;
  pixelRatio: number;
  targetFps: number;
}

/**
 * Fill in defaults and validate. Invalid values throw immediately rather than producing a
 * silently mis-timed simulation, which is far harder to debug.
 */
export function resolveEngineConfig(config: EngineConfig = {}): ResolvedEngineConfig {
  const canvas = config.canvas ?? null;
  const width = config.width ?? canvas?.width ?? 1280;
  const height = config.height ?? canvas?.height ?? 720;

  if (!Number.isFinite(width) || width <= 0) throw new Error(`EngineConfig.width must be > 0, received ${width}`);
  if (!Number.isFinite(height) || height <= 0) throw new Error(`EngineConfig.height must be > 0, received ${height}`);

  const fixedTimeStep = config.fixedTimeStep ?? 1 / 60;
  if (!Number.isFinite(fixedTimeStep) || fixedTimeStep <= 0 || fixedTimeStep > 1) {
    throw new Error(`EngineConfig.fixedTimeStep must be within (0, 1], received ${fixedTimeStep}`);
  }

  const maxDeltaTime = config.maxDeltaTime ?? 0.25;
  if (!Number.isFinite(maxDeltaTime) || maxDeltaTime <= 0) {
    throw new Error(`EngineConfig.maxDeltaTime must be > 0, received ${maxDeltaTime}`);
  }

  const headless = config.headless ?? !canvas;
  if (!headless && !canvas) {
    throw new Error('EngineConfig.canvas is required unless headless mode is enabled');
  }

  const devicePixelRatio = typeof globalThis !== 'undefined'
    ? (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1
    : 1;

  return {
    canvas,
    width,
    height,
    fixedTimeStep,
    maxDeltaTime,
    renderer: config.renderer ?? 'auto',
    debug: config.debug ?? false,
    headless,
    pixelRatio: config.pixelRatio ?? devicePixelRatio,
    targetFps: config.targetFps ?? 0,
  };
}
