import { World } from './World';
import { GameLoop } from './GameLoop';
import { EventBus } from './EventBus';
import { resolveEngineConfig } from './EngineConfig';
import { Input } from '../input/Input';
import { InputSystem } from '../systems/InputSystem';
import { TransformSystem } from '../systems/TransformSystem';
import { ScriptSystem } from '../systems/ScriptSystem';
import { RenderSystem } from '../systems/RenderSystem';
import { Canvas2DRenderer } from '../renderer/Canvas2DRenderer';
import { AssetManager } from '../assets/AssetManager';
import { Logger } from '../diagnostics/Logger';
import { Metrics } from '../diagnostics/Metrics';
import { Profiler } from '../diagnostics/Profiler';
import { DebugDraw } from '../diagnostics/DebugDraw';
import { BrowserPlatform, HeadlessPlatform } from '../platform/BrowserPlatform';
import { ElectronPlatform } from '../platform/ElectronPlatform';
import { detectPlatformKind } from '../platform/Platform';
import type { EngineConfig, ResolvedEngineConfig, RendererBackend } from './EngineConfig';
import type { EngineEvents } from './EngineEvents';
import type { Game } from './Game';
import type { Platform } from '../platform/Platform';
import type { Renderer } from '../renderer/Renderer';
import type { MetricsSnapshot } from '../diagnostics/Metrics';

export interface EngineOptions {
  /** Override the host platform. Defaults to browser/electron/headless detection. */
  platform?: Platform;
  /** Override the renderer. Defaults to Canvas2D (WebGL2 arrives in milestone 2). */
  renderer?: Renderer;
  /** Game to run. May also be passed to `start` so the runtime can import it lazily. */
  game?: Game;
  events?: EventBus<EngineEvents>;
  logger?: Logger;
  /** Skip registering the default systems (transform, input, script, render). */
  registerDefaultSystems?: boolean;
}

/**
 * Owns the application lifecycle: platform, renderer, world, loop and services.
 *
 * `start()` initialises the backend, wires the default systems and runs the game's `setup` before
 * the first frame, so a game never observes a half-built engine. Everything the engine creates can
 * be disposed with `stop()`, and `advance()` drives the simulation without any scheduler for
 * deterministic tests and headless validation.
 */
export class Engine {
  readonly config: ResolvedEngineConfig;
  readonly world: World;
  readonly renderer: Renderer;
  readonly input = new Input();
  readonly assets: AssetManager;
  readonly logger: Logger;
  readonly metrics = new Metrics();
  readonly profiler: Profiler;
  readonly debugDraw: DebugDraw;
  readonly platform: Platform;
  readonly loop: GameLoop;
  readonly events: EventBus<EngineEvents>;

  private game: Game | null;
  private renderSystem: RenderSystem | null = null;
  private transformSystem: TransformSystem | null = null;
  private scriptSystem: ScriptSystem | null = null;
  private inputSystem: InputSystem | null = null;
  private startedValue = false;
  private readyValue = false;
  private startedAt = 0;
  private lastRenderAt = 0;

  constructor(config: EngineConfig = {}, options: EngineOptions = {}) {
    this.config = resolveEngineConfig(config);
    this.logger = options.logger ?? new Logger({
      level: this.config.debug ? 'debug' : 'info',
      scope: 'engine',
      // Headless runs (tests, CI) should stay quiet unless something is wrong.
      mirrorToConsole: !this.config.headless,
    });
    this.profiler = new Profiler(this.config.debug);
    this.debugDraw = new DebugDraw(this.config.debug);
    this.events = options.events ?? new EventBus<EngineEvents>();
    this.platform = options.platform ?? Engine.createPlatform(options.logger);
    this.world = new World({ events: this.events, onError: (error, context) => this.logger.error(context, error) });
    this.renderer = options.renderer ?? Engine.createRenderer(this.config, this.platform);
    this.assets = new AssetManager({
      events: this.events,
      logger: this.logger.child('assets'),
      fetchImpl: typeof fetch === 'function' ? fetch : undefined,
    });
    this.game = options.game ?? null;

    // Services let systems reach shared resources without importing the Engine (no cycles).
    Object.assign(this.world.services, {
      renderer: this.renderer,
      input: this.input,
      assets: this.assets,
      logger: this.logger,
      platform: this.platform,
      engine: this,
      metrics: this.metrics,
      profiler: this.profiler,
      debugDraw: this.debugDraw,
    });

    this.loop = new GameLoop(
      {
        fixedTimeStep: this.config.fixedTimeStep,
        maxDeltaTime: this.config.maxDeltaTime,
        schedule: (callback) => this.platform.requestFrame(() => callback()),
        cancel: (handle) => this.platform.cancelFrame(handle),
      },
      {
        update: (delta) => this.update(delta),
        render: (alpha) => this.render(alpha),
      },
    );

    if (options.registerDefaultSystems !== false) this.registerDefaultSystems();
  }

  /** Pick a platform: Electron when the shell bridge is present, else browser or headless. */
  private static createPlatform(logger?: Logger): Platform {
    const kind = detectPlatformKind();
    if (kind === 'electron') return new ElectronPlatform();
    if (kind === 'browser') return new BrowserPlatform('browser');
    logger?.debug('no DOM detected - using the headless platform');
    return new HeadlessPlatform();
  }

  /**
   * Pick a renderer. Canvas2D is the shipped backend; requesting WebGL2 before milestone 2 lands
   * fails loudly rather than silently degrading, because a silent fallback hides missing work.
   */
  private static createRenderer(config: ResolvedEngineConfig, platform: Platform): Renderer {
    if (config.headless) return new Canvas2DRenderer(null);

    if (config.renderer === 'webgl2') {
      throw new Error(
        'WebGL2 renderer is not implemented yet (milestone 2). Use renderer: "auto" or "canvas2d".',
      );
    }

    const canvas = config.canvas ?? platform.createCanvas?.(config.width, config.height) ?? null;
    if (!canvas) throw new Error('No canvas available: pass EngineConfig.canvas or enable headless mode');
    return new Canvas2DRenderer(canvas);
  }

  private registerDefaultSystems(): void {
    this.inputSystem = new InputSystem();
    this.transformSystem = new TransformSystem();
    this.scriptSystem = new ScriptSystem({ onError: (error, context) => this.logger.error(context, error) });
    this.renderSystem = new RenderSystem({ renderer: this.renderer, clearColor: '#0b1020', cull: true });

    this.world
      .addSystem(this.inputSystem)
      .addSystem(this.transformSystem)
      .addSystem(this.scriptSystem)
      .addSystem(this.renderSystem);
  }

  /* ------------------------------------------------------------------ lifecycle */

  get isStarted(): boolean {
    return this.startedValue;
  }

  get isReady(): boolean {
    return this.readyValue;
  }

  get gameRef(): Game | null {
    return this.game;
  }

  get backend(): RendererBackend {
    return this.renderer.backend;
  }

  /** Initialise the backend, attach input, run the game's setup, then begin the loop. */
  async start(game?: Game): Promise<void> {
    if (this.startedValue) return;
    if (game) this.game = game;

    await this.renderer.initialize();
    this.renderer.resize(this.config.width, this.config.height, this.config.pixelRatio);

    if (!this.config.headless) {
      this.input.attach({
        element: this.config.canvas,
        pointerTarget: this.config.canvas ?? undefined,
        preventDefault: true,
      });
    }

    this.readyValue = true;
    this.events.emit('engine:ready', {
      backend: this.renderer.backend,
      width: this.renderer.width,
      height: this.renderer.height,
    });

    if (this.game) {
      try {
        await this.game.setup(this);
      } catch (error) {
        this.events.emit('engine:error', { error: error as Error, phase: 'setup' });
        throw error;
      }
    }

    if (this.config.headless) {
      // No scheduler in headless mode: the caller drives `advance()`.
      this.startedValue = true;
      this.startedAt = this.platform.now();
      this.events.emit('engine:started', { startedAt: this.startedAt });
      return;
    }

    this.loop.start();
    this.startedValue = true;
    this.startedAt = this.platform.now();
    this.events.emit('engine:started', { startedAt: this.startedAt });
    this.logger.info(`engine started (${this.renderer.backend} ${this.renderer.width}x${this.renderer.height})`);
  }

  /** Stop the loop and release the game's resources. The engine can be started again. */
  async stop(): Promise<void> {
    if (!this.startedValue) return;
    this.loop.stop();
    this.input.detach();

    if (this.game?.teardown) {
      try {
        await this.game.teardown(this);
      } catch (error) {
        this.logger.error('error in game teardown', error);
      }
    }

    this.startedValue = false;
    this.events.emit('engine:stopped', { frames: this.loop.stats.frames, elapsed: this.loop.clock.elapsed });
  }

  pause(): void {
    this.loop.pause();
    this.events.emit('engine:paused', { elapsed: this.loop.clock.elapsed });
  }

  resume(): void {
    this.loop.resume();
    this.events.emit('engine:resumed', { elapsed: this.loop.clock.elapsed });
  }

  get isPaused(): boolean {
    return this.loop.isPaused;
  }

  /* ------------------------------------------------------------------ stepping */

  /** One fixed simulation step: systems run, then input edges are cleared. */
  update(deltaSeconds: number): void {
    this.profiler.begin('update');
    try {
      this.world.update(deltaSeconds);
      // Cleared after the step so "pressed" means "pressed during this step".
      this.input.endFrame();
      this.metrics.recordWorld(this.world.entityCount, this.loop.clock.elapsed);
    } finally {
      this.profiler.end('update');
    }
  }

  /** One presentation step. */
  render(alpha: number): void {
    // Frame time is measured here, per rendered frame, so the reported FPS is real. Reading it from
    // the loop's stats would lag by one frame and report 0 for the first frame.
    const frameStart = this.platform.now();
    // The first frame has no previous timestamp: record it with a zero delta so the frame counter
    // reflects every rendered frame rather than starting at the second one.
    this.metrics.recordFrame(this.lastRenderAt > 0 ? frameStart - this.lastRenderAt : 0);
    this.lastRenderAt = frameStart;

    this.profiler.begin('render');
    try {
      this.world.render(alpha);
      this.profiler.end('render');
      this.profiler.endFrame();
    } catch (error) {
      this.profiler.end('render');
      this.profiler.endFrame();
      this.events.emit('engine:error', { error: error as Error, phase: 'render' });
      this.logger.error('render failed', error);
    }
  }

  /**
   * Run an exact number of fixed steps without a scheduler - the deterministic entry point used by
   * tests and the headless smoke test. Optionally renders once at the end.
   */
  advance(steps: number, options: { render?: boolean } = {}): void {
    for (let i = 0; i < steps; i += 1) {
      this.loop.clock.step(this.config.fixedTimeStep);
      this.update(this.config.fixedTimeStep);
    }
    if (options.render ?? !this.config.headless) this.render(0);
  }

  resize(width: number, height: number, pixelRatio: number = this.config.pixelRatio): void {
    this.renderer.resize(width, height, pixelRatio);
    this.events.emit('engine:resized', { width, height, pixelRatio });
  }

  /* ------------------------------------------------------------------ diagnostics */

  get metricsSnapshot(): MetricsSnapshot {
    return this.metrics.snapshot();
  }

  get uptimeSeconds(): number {
    return this.startedValue ? (this.platform.now() - this.startedAt) / 1000 : 0;
  }

  /** Current state as a plain object: the portal's runtime panel and the Electron shell read this. */
  runtimeState(): Record<string, unknown> {
    const metrics = this.metrics.snapshot();
    return {
      backend: this.renderer.backend,
      width: this.renderer.width,
      height: this.renderer.height,
      pixelRatio: this.renderer.pixelRatio,
      fps: Math.round(metrics.fps * 10) / 10,
      frameTimeMs: Math.round(metrics.frameTimeMs * 100) / 100,
      frames: metrics.frames,
      entities: this.world.entityCount,
      activeScene: this.world.activeScene?.name ?? null,
      scenes: this.world.sceneNames,
      drawCalls: metrics.drawCalls,
      assets: this.assets.stats,
      uptimeSeconds: Math.round(this.uptimeSeconds * 10) / 10,
      paused: this.isPaused,
    };
  }

  /** Push state to the host shell when one is attached (Electron). Otherwise a no-op. */
  reportRuntimeState(): void {
    if (this.platform instanceof ElectronPlatform) this.platform.reportState(this.runtimeState());
  }

  dispose(): void {
    this.loop.stop();
    this.input.detach();
    this.world.dispose();
    this.renderer.dispose();
    this.assets.clear();
    this.events.clear();
    this.readyValue = false;
    this.startedValue = false;
  }
}
