import { Clock } from './Clock';

export interface GameLoopOptions {
  /** Simulation step in seconds. Defaults to 1/60. */
  fixedTimeStep?: number;
  /** Largest frame delta accepted before clamping, in seconds. Guards against tab-switch spikes. */
  maxDeltaTime?: number;
  /** Upper bound on simulation steps per frame, so a slow frame cannot spiral. */
  maxSubSteps?: number;
  /** Frame scheduler. Defaults to requestAnimationFrame in a browser, setTimeout elsewhere. */
  schedule?: (callback: () => void) => number;
  cancel?: (handle: number) => void;
  /** Override the time source - tests inject a fake clock. */
  clock?: Clock;
}

export interface GameLoopCallbacks {
  /** Fixed-rate simulation step. */
  update(deltaSeconds: number): void;
  /** Variable-rate presentation step; `alpha` is the interpolation factor into the next step. */
  render(alpha: number, frameDelta: number): void;
}

export interface GameLoopStats {
  fps: number;
  frameTimeMs: number;
  frames: number;
  updateSteps: number;
  droppedTime: number;
}

const DEFAULT_SCHEDULE = (callback: () => void): number => {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(() => callback());
  return setTimeout(callback, 16) as unknown as number;
};

const DEFAULT_CANCEL = (handle: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
};

/**
 * Frame loop with a fixed simulation step and variable rendering.
 *
 * Simulation runs in whole `fixedTimeStep` slices so physics and gameplay stay reproducible;
 * rendering happens once per frame with an interpolation alpha. Headless callers skip the
 * scheduler entirely by using `advance()` / `frame()`, which is what the engine tests do.
 */
export class GameLoop {
  readonly clock: Clock;

  private readonly callbacks: GameLoopCallbacks;
  private readonly schedule: (callback: () => void) => number;
  private readonly cancel: (handle: number) => void;
  private accumulator = 0;
  private handle: number | null = null;
  private running = false;
  private fpsValue = 0;
  private frameTimeValue = 0;
  private framesValue = 0;
  private updateStepsValue = 0;
  private droppedTimeValue = 0;

  readonly fixedTimeStep: number;
  readonly maxDeltaTime: number;
  readonly maxSubSteps: number;

  constructor(options: GameLoopOptions, callbacks: GameLoopCallbacks) {
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    this.maxDeltaTime = options.maxDeltaTime ?? 0.25;
    this.maxSubSteps = Math.max(1, options.maxSubSteps ?? 5);
    this.schedule = options.schedule ?? DEFAULT_SCHEDULE;
    this.cancel = options.cancel ?? DEFAULT_CANCEL;
    this.clock = options.clock ?? new Clock();
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.handle = this.schedule(this.onFrame);
  }

  stop(): void {
    this.running = false;
    this.clock.stop();
    if (this.handle !== null) {
      this.cancel(this.handle);
      this.handle = null;
    }
  }

  pause(): void {
    this.clock.pause();
  }

  resume(): void {
    this.clock.resume();
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isPaused(): boolean {
    return this.clock.isPaused;
  }

  get interpolationAlpha(): number {
    return this.fixedTimeStep > 0 ? this.accumulator / this.fixedTimeStep : 0;
  }

  get stats(): GameLoopStats {
    return {
      fps: this.fpsValue,
      frameTimeMs: this.frameTimeValue,
      frames: this.framesValue,
      updateSteps: this.updateStepsValue,
      droppedTime: this.droppedTimeValue,
    };
  }

  private readonly onFrame = (): void => {
    if (!this.running) return;
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.frame(this.clock.tick());

    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    // Exponential moving average keeps the reported FPS readable instead of jittery.
    this.frameTimeValue = this.frameTimeValue === 0 ? elapsed : this.frameTimeValue * 0.9 + elapsed * 0.1;
    const instantFps = elapsed > 0 ? 1000 / elapsed : 0;
    this.fpsValue = this.fpsValue === 0 ? instantFps : this.fpsValue * 0.9 + instantFps * 0.1;

    this.handle = this.schedule(this.onFrame);
  };

  /**
   * Advance one variable-rate frame.
   *
   * Runs zero or more fixed simulation steps, then renders once. Excess time beyond
   * `maxSubSteps` is discarded (and reported in `stats.droppedTime`) rather than accumulated
   * forever, which is what prevents the classic spiral-of-death on a stalled tab.
   */
  frame(frameDelta: number): void {
    if (this.clock.isPaused) {
      this.callbacks.render(0, 0);
      return;
    }

    const clamped = Math.min(Math.max(frameDelta, 0), this.maxDeltaTime);
    this.accumulator += clamped;

    let steps = 0;
    while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
      this.callbacks.update(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      steps += 1;
      this.updateStepsValue += 1;
    }

    if (this.accumulator >= this.fixedTimeStep) {
      // Still behind after the step budget: drop the backlog instead of falling further behind.
      this.droppedTimeValue += this.accumulator;
      this.accumulator = 0;
    }

    this.framesValue += 1;
    this.callbacks.render(this.interpolationAlpha, clamped);
  }

  /**
   * Run exactly `steps` fixed simulation steps. Deterministic and scheduler-free, so a test can
   * assert simulation state without involving wall-clock time.
   */
  advance(steps: number): void {
    for (let i = 0; i < steps; i += 1) {
      this.clock.step(this.fixedTimeStep);
      this.callbacks.update(this.fixedTimeStep);
      this.updateStepsValue += 1;
    }
  }

  /** Reset accumulated frame state, keeping options intact. */
  reset(): void {
    this.accumulator = 0;
    this.fpsValue = 0;
    this.frameTimeValue = 0;
    this.framesValue = 0;
    this.updateStepsValue = 0;
    this.droppedTimeValue = 0;
    this.clock.reset();
  }
}
