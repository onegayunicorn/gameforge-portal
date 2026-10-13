import { Color } from '../math/Color';
import type { RendererBackend } from '../core/EngineConfig';
import type { Camera } from './Camera';
import type { DrawCommand, RenderStats } from './RenderContext';
import { createRenderStats, resetRenderStats } from './RenderContext';

export interface RendererCapabilities {
  backend: RendererBackend;
  supportsTextures: boolean;
  supportsRotation: boolean;
  supportsBlending: boolean;
  supportsLines: boolean;
  /** Largest texture edge the backend accepts. */
  maxTextureSize: number;
  /** True when the backend can render without a DOM canvas (headless tests). */
  headless: boolean;
}

export interface BeginFrameOptions {
  clearColor?: Color | null;
  camera?: Camera | null;
}

/**
 * The contract every rendering backend implements.
 *
 * The 2D backend ships first (milestone 1); the WebGL2 backend in milestone 2 implements the same
 * interface so game code and RenderSystem never need to know which one is active.
 */
export interface Renderer {
  readonly backend: RendererBackend;
  readonly capabilities: RendererCapabilities;
  readonly stats: RenderStats;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;

  initialize(): Promise<void>;
  resize(width: number, height: number, pixelRatio?: number): void;
  beginFrame(options?: BeginFrameOptions): void;
  endFrame(): void;
  draw(command: DrawCommand): void;
  dispose(): void;
}

/** Shared bookkeeping so each backend only implements its own painting calls. */
export abstract class BaseRenderer implements Renderer {
  readonly abstract backend: RendererBackend;
  readonly abstract capabilities: RendererCapabilities;
  readonly stats: RenderStats = createRenderStats();

  protected viewportWidthValue = 0;
  protected viewportHeightValue = 0;
  protected pixelRatioValue = 1;
  protected currentCamera: Camera | null = null;

  get width(): number {
    return this.viewportWidthValue;
  }

  get height(): number {
    return this.viewportHeightValue;
  }

  get pixelRatio(): number {
    return this.pixelRatioValue;
  }

  async initialize(): Promise<void> {
    // Backends with nothing to prepare can rely on this default.
  }

  resize(width: number, height: number, pixelRatio: number = 1): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error(`Renderer.resize received invalid size ${width}x${height}`);
    }
    this.viewportWidthValue = width;
    this.viewportHeightValue = height;
    this.pixelRatioValue = pixelRatio;
  }

  beginFrame(options: BeginFrameOptions = {}): void {
    resetRenderStats(this.stats);
    this.stats.frames += 1;
    this.currentCamera = options.camera ?? null;
    const started = now();
    this.clear(options.clearColor ?? Color.BLACK);
    this.stats.drawTimeMs = now() - started;
  }

  endFrame(): void {
    // Backends that buffer geometry flush here; Canvas2D draws immediately.
  }

  draw(command: DrawCommand): void {
    const started = now();
    switch (command.kind) {
      case 'quad':
        this.stats.quads += 1;
        this.drawQuadCommand(command);
        break;
      case 'circle':
        this.stats.circles += 1;
        this.drawCircleCommand(command);
        break;
      case 'line':
        this.stats.lines += 1;
        this.drawLineCommand(command);
        break;
    }
    this.stats.drawCalls += 1;
    this.stats.drawTimeMs += now() - started;
  }

  protected abstract clear(color: Color): void;
  protected abstract drawQuadCommand(command: Extract<DrawCommand, { kind: 'quad' }>): void;
  protected abstract drawCircleCommand(command: Extract<DrawCommand, { kind: 'circle' }>): void;
  protected abstract drawLineCommand(command: Extract<DrawCommand, { kind: 'line' }>): void;

  dispose(): void {
    this.currentCamera = null;
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
