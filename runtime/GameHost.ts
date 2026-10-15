import { BrowserDisplayAdapter, Engine, isGame } from '@gameforge/engine';
import type { DisplayAdapter } from '@gameforge/engine';
import type { Game, EngineEvents } from '@gameforge/engine';
import { LoadingScreen } from './LoadingScreen';
import { ErrorScreen } from './ErrorScreen';

/** Build metadata written by the pipeline as `game.json`. */
export interface GameBuildInfo {
  id: string;
  name: string;
  version: string;
  engine: string;
  width: number;
  height: number;
  clearColor: string;
  renderer: 'auto' | 'canvas2d' | 'webgl2';
  pixelArt: boolean;
  debug: boolean;
  /** Module to import for the game, relative to the document. */
  entry: string;
  /** Asset manifest, relative to the document, or null for a code-only game. */
  manifest: string | null;
  builtAt?: string;
}

export interface GameHostElements {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  status: HTMLElement;
  restart: HTMLButtonElement;
  fullscreen: HTMLButtonElement;
  stage?: HTMLElement;
}

export interface GameHostOptions {
  info: GameBuildInfo;
  elements: GameHostElements;
  /** Import a module by URL. Injectable so tests can supply a game directly. */
  importGame?: (url: string) => Promise<unknown>;
  /** Report runtime state to the host shell (Electron). Defaults to true when a bridge exists. */
  reportToShell?: boolean;
  /** Override the DOM display bridge for an editor, embedded preview or alternate host. */
  displayAdapter?: DisplayAdapter;
}

/**
 * Wires a built game to the page: engine creation, asset loading, module import, error surfacing
 * and the state reporting the Electron shell consumes.
 *
 * Kept separate from `bootstrap.ts` so the same host can run inside the portal's preview pane or a
 * test harness without duplicating any of this wiring.
 */
export class GameHost {
  private engineInstance: Engine | null = null;
  private game: Game | null = null;
  private loading: LoadingScreen | null = null;
  private errorScreen: ErrorScreen | null = null;
  private statusTimer: number | null = null;
  private unsubscribers: (() => void)[] = [];
  private displayAdapter: DisplayAdapter | null = null;

  constructor(private readonly options: GameHostOptions) {}

  get engine(): Engine | null {
    return this.engineInstance;
  }

  get info(): GameBuildInfo {
    return this.options.info;
  }

  /** The imported game module, once `start()` has resolved it. */
  get gameModule(): Game | null {
    return this.game;
  }

  private setStatus(state: 'booting' | 'loading' | 'running' | 'paused' | 'error', detail?: string): void {
    const { status } = this.options.elements;
    status.dataset.state = state;
    status.textContent = detail ? `${state} · ${detail}` : state;
  }

  async start(): Promise<Engine> {
    const { info, elements } = this.options;

    this.loading = new LoadingScreen(elements.overlay, info.name);
    this.errorScreen = new ErrorScreen(elements.overlay, {
      hint: 'Run `npm run game:dev` from this project to rebuild and reload, or use Restart.',
    });
    this.errorScreen.element.hidden = true;

    const engine = new Engine({
      canvas: elements.canvas,
      width: info.width,
      height: info.height,
      renderer: info.renderer === 'webgl2' ? 'auto' : info.renderer,
      debug: info.debug,
    });
    this.engineInstance = engine;
    this.displayAdapter = this.options.displayAdapter ?? new BrowserDisplayAdapter({
      canvas: elements.canvas,
      stage: elements.stage,
      logicalWidth: info.width,
      logicalHeight: info.height,
      maxPixelRatio: 2,
    });
    this.displayAdapter.attach(engine);

    // Surface engine-level failures (a throwing system, a failed setup) in the overlay.
    this.unsubscribers.push(engine.events.on('engine:error', ({ error, phase }) => {
      this.setStatus('error', phase);
      this.loading?.fail('Engine error');
      this.errorScreen?.show(error, phase);
    }));

    // Asset progress drives the loading bar.
    this.unsubscribers.push(engine.events.on('asset:progress', ({ loaded, total, id }) => {
      this.loading?.setProgress(loaded, total, id);
    }));
    this.unsubscribers.push(engine.events.on('asset:failed', ({ id, error }) => {
      engine.logger.warn(`asset failed: ${id}`, error.message);
    }));

    this.wireControls(elements);

    try {
      this.setStatus('loading');
      await this.loadAssets(engine);

      const game = await this.importGame(info.entry);
      this.game = game;

      await engine.start(game);
      this.setStatus('running');
      this.loading.hide();
      this.startStateReporting();
      return engine;
    } catch (error) {
      this.setStatus('error');
      this.loading?.fail('Failed to start');
      this.errorScreen?.show(error, 'startup');
      throw error;
    }
  }

  private async loadAssets(engine: Engine): Promise<void> {
    const { manifest } = this.options.info;
    if (!manifest) {
      this.loading?.setProgress(1, 1, 'no assets');
      return;
    }
    this.loading?.setSubtitle('Reading asset manifest…');
    await engine.assets.loadManifest(manifest);
    const report = await engine.assets.preloadAll();
    if (report.failed.length > 0) {
      // A missing asset is a warning, not a fatal error: the game still runs without it.
      engine.logger.warn(`${report.failed.length} asset(s) failed to load`, report.failed);
      this.loading?.setProgress(report.loaded, report.total, `${report.failed.length} failed`);
    }
  }

  private async importGame(entryUrl: string): Promise<Game> {
    const importer = this.options.importGame ?? ((url: string) => import(/* @vite-ignore */ url));
    const module = await importer(entryUrl);
    if (isGame(module)) return module;

    // A default export is also accepted, which is the natural shape for a module with one game.
    const fallback = (module as { default?: unknown }).default;
    if (isGame(fallback)) return fallback;

    throw new Error(
      `Module ${entryUrl} does not export a game. Expected \`export function setup(engine)\` or a default export.`,
    );
  }

  private wireControls(elements: GameHostElements): void {
    elements.restart.addEventListener('click', () => {
      // A full restart re-runs setup against a clean world; reloading is the honest way to get that
      // without a scene-teardown path that the engine does not have yet.
      window.location.reload();
    });

    elements.fullscreen.addEventListener('click', () => {
      void (this.displayAdapter?.requestFullscreen() ?? Promise.resolve()).catch(() => undefined);
    });
  }

  private startStateReporting(): void {
    const engine = this.engineInstance;
    if (!engine) return;
    const report = this.options.reportToShell ?? true;
    if (!report) return;

    const tick = () => {
      engine.reportRuntimeState();
      const state = engine.runtimeState();
      const fps = typeof state.fps === 'number' ? state.fps : 0;
      const entities = typeof state.entities === 'number' ? state.entities : 0;
      this.setStatus(engine.isPaused ? 'paused' : 'running', `${fps} fps · ${entities} entities`);
    };
    tick();
    this.statusTimer = window.setInterval(tick, 500);
  }

  async stop(): Promise<void> {
    if (this.statusTimer !== null) {
      window.clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    await this.engineInstance?.stop();
    this.displayAdapter?.dispose();
    this.displayAdapter = null;
    this.engineInstance?.dispose();
    this.engineInstance = null;
    this.game = null;
    this.setStatus('booting');
  }
}

/** Subscribe helper used by the portal preview pane to render its own runtime console. */
export function collectRuntimeLogs(engine: Engine, sink: (entry: { level: string; message: string }) => void): () => void {
  return engine.logger.addSink((entry) => sink({ level: entry.level, message: `${entry.scope}: ${entry.message}` }));
}

export type { EngineEvents };
