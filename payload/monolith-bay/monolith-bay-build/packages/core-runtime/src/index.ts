// @monolith/core-runtime
// Core runtime types, lifecycle, and game loop.

export type RuntimeMode =
  | "boot"
  | "title"
  | "loading"
  | "playing"
  | "paused"
  | "phone"
  | "dialogue"
  | "activity"
  | "map"
  | "inventory"
  | "save"
  | "error";

export interface RuntimeState {
  mode: RuntimeMode;
  buildVersion: string;
  contentVersion: string;
  currentWorldId: string;
  currentLocationId: string;
  sessionId: string;
  isOffline: boolean;
  isPaused: boolean;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface Updatable {
  update(dt: number): void;
}

export interface Renderable {
  render(alpha: number): void;
}

export const FIXED_STEP = 1 / 60;

export class GameLoop {
  private accumulator = 0;
  private previousTime = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private update: (dt: number) => void,
    private render: (alpha: number) => void,
  ) {}

  start() {
    this.running = true;
    this.previousTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const delta = Math.min((now - this.previousTime) / 1000, 0.25);
    this.previousTime = now;
    this.accumulator += delta;
    while (this.accumulator >= FIXED_STEP) {
      this.update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.render(this.accumulator / FIXED_STEP);
    this.rafId = requestAnimationFrame(this.frame);
  };
}

export function createLogger(level: string = "info"): Logger {
  const levels = ["debug", "info", "warn", "error"];
  const min = levels.indexOf(level);
  return {
    debug: (...a) => min <= 0 && console.debug("[MB]", ...a),
    info: (...a) => min <= 1 && console.info("[MB]", ...a),
    warn: (...a) => min <= 2 && console.warn("[MB]", ...a),
    error: (...a) => min <= 3 && console.error("[MB]", ...a),
  };
}
