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

export interface RuntimeDeps {
  env: Record<string, unknown>;
  logger: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  contentManifest: Record<string, unknown>;
  saveManager: { initialize(): Promise<void> };
  settings: Record<string, unknown>;
  inputManager: { attach(target: Window): void };
  audioManager: unknown;
  renderer: { render(alpha: number): void };
}

const FIXED_STEP = 1 / 60;

export class Runtime {
  private state: RuntimeState;
  private deps: RuntimeDeps;
  private uiManager: { render(): void } | null = null;
  private accumulator = 0;
  private previousTime = performance.now();
  private running = false;

  constructor(deps: RuntimeDeps) {
    this.deps = deps;
    this.state = {
      mode: "title",
      buildVersion: String(deps.env.appVersion ?? "0.1.0"),
      contentVersion: String(deps.env.contentVersion ?? "0.1.0"),
      currentWorldId: "world.town",
      currentLocationId: "location.town-square",
      sessionId: crypto.randomUUID(),
      isOffline: !navigator.onLine,
      isPaused: false,
    };
  }

  setUIManager(ui: { render(): void }) {
    this.uiManager = ui;
  }

  getState(): RuntimeState {
    return { ...this.state };
  }

  setMode(mode: RuntimeMode) {
    this.deps.logger.info(`Runtime mode: ${this.state.mode} -> ${mode}`);
    this.state.mode = mode;
    this.state.isPaused = mode !== "playing";
  }

  start() {
    this.running = true;
    this.previousTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
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
    this.deps.renderer.render(this.accumulator / FIXED_STEP);
    this.uiManager?.render();
    requestAnimationFrame(this.frame);
  };

  private update(_dt: number) {
    // Gameplay systems tick here
  }
}
