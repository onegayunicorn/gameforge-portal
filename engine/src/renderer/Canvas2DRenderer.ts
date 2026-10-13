import { Color } from '../math/Color';
import { BaseRenderer } from './Renderer';
import type { RendererCapabilities } from './Renderer';
import type { RendererBackend } from '../core/EngineConfig';
import type { BlendMode } from './Material';

const BLEND_MODES: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  additive: 'lighter',
  multiply: 'multiply',
};

export interface Canvas2DRendererOptions {
  /** Disable image smoothing for crisp pixel art. */
  pixelArt?: boolean;
}

/**
 * Canvas2D rendering backend.
 *
 * This is the reference implementation of the renderer contract and the guaranteed fallback: it
 * runs everywhere, needs no extensions, and gives milestone 1 a complete, testable render path.
 * The WebGL2 backend added in milestone 2 implements the same interface.
 */
export class Canvas2DRenderer extends BaseRenderer {
  readonly backend: RendererBackend = 'canvas2d';
  readonly capabilities: RendererCapabilities = {
    backend: 'canvas2d',
    supportsTextures: true,
    supportsRotation: true,
    supportsBlending: true,
    supportsLines: true,
    maxTextureSize: 16384,
    headless: false,
  };

  private readonly canvas: HTMLCanvasElement | null;
  private context: CanvasRenderingContext2D | null = null;
  private readonly pixelArt: boolean;

  constructor(canvas: HTMLCanvasElement | null, options: Canvas2DRendererOptions = {}) {
    super();
    this.canvas = canvas;
    this.pixelArt = options.pixelArt ?? false;
    this.capabilities.headless = canvas === null;
  }

  /** Cheap capability probe so the engine can pick a backend before constructing it. */
  static isSupported(canvas: HTMLCanvasElement | null): boolean {
    if (!canvas && typeof document === 'undefined') return false;
    if (!canvas) return false;
    try {
      return canvas.getContext('2d') !== null;
    } catch {
      return false;
    }
  }

  override async initialize(): Promise<void> {
    if (!this.canvas) return;
    this.context = this.canvas.getContext('2d', { alpha: false });
    if (!this.context) throw new Error('Canvas2DRenderer: 2D context is unavailable on this canvas');
    this.context.imageSmoothingEnabled = !this.pixelArt;
  }

  override resize(width: number, height: number, pixelRatio: number = 1): void {
    super.resize(width, height, pixelRatio);
    if (!this.canvas) return;
    const backingWidth = Math.max(1, Math.round(width * pixelRatio));
    const backingHeight = Math.max(1, Math.round(height * pixelRatio));
    // Only touch width/height when they actually change: assigning clears the canvas.
    if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
    if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
    if (this.context) this.context.imageSmoothingEnabled = !this.pixelArt;
  }

  protected override clear(color: Color): void {
    const ctx = this.context;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (color.a >= 1) {
      ctx.fillStyle = color.toCss();
      ctx.fillRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    } else {
      // Translucent clear needs the erase composite, otherwise alpha accumulates forever.
      ctx.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
      if (color.a > 0) {
        ctx.fillStyle = color.toCss();
        ctx.fillRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
      }
    }
    this.applyCameraTransform();
  }

  /** World -> viewport transform, applied once per frame rather than per draw call. */
  private applyCameraTransform(): void {
    const ctx = this.context;
    if (!ctx) return;
    ctx.setTransform(this.pixelRatioValue, 0, 0, this.pixelRatioValue, 0, 0);
    const camera = this.currentCamera;
    if (!camera) return;
    ctx.translate(camera.viewportWidth / 2, camera.viewportHeight / 2);
    if (camera.rotation !== 0) ctx.rotate(camera.rotation);
    if (camera.zoom !== 1) ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.position.x, -camera.position.y);
  }

  protected override drawQuadCommand(command: Extract<import('./RenderContext').DrawCommand, { kind: 'quad' }>): void {
    const ctx = this.context;
    if (!ctx) return;

    const alpha = command.alpha * command.material.opacity * command.material.color.a;
    if (alpha <= 0) return;

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = BLEND_MODES[command.blend] ?? 'source-over';

    const needsTransform =
      command.rotation !== 0 || command.flipX || command.flipY;
    const left = -command.originX;
    const top = -command.originY;

    const drawBody = (): void => {
      const material = command.material;
      if (material.isTextured && material.texture?.source) {
        const uv = material.uvRect;
        if (uv) {
          ctx.drawImage(
            material.texture.source as CanvasImageSource,
            uv.x, uv.y, uv.width, uv.height,
            left, top, command.width, command.height,
          );
          return;
        }
      }
      ctx.fillStyle = material.color.toCss();
      ctx.fillRect(left, top, command.width, command.height);
    };

    if (!needsTransform) {
      ctx.save();
      ctx.translate(command.x, command.y);
      drawBody();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(command.x, command.y);
    if (command.rotation !== 0) ctx.rotate(command.rotation);
    if (command.flipX || command.flipY) ctx.scale(command.flipX ? -1 : 1, command.flipY ? -1 : 1);
    drawBody();
    ctx.restore();
  }

  protected override drawCircleCommand(command: Extract<import('./RenderContext').DrawCommand, { kind: 'circle' }>): void {
    const ctx = this.context;
    if (!ctx) return;
    const alpha = command.alpha * command.color.a;
    if (alpha <= 0 || command.radius <= 0) return;

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = BLEND_MODES[command.blend] ?? 'source-over';
    ctx.beginPath();
    ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2);
    if (command.filled) {
      ctx.fillStyle = command.color.toCss();
      ctx.fill();
    } else {
      ctx.strokeStyle = command.color.toCss();
      ctx.lineWidth = Math.max(0.1, command.lineWidth);
      ctx.stroke();
    }
  }

  protected override drawLineCommand(command: Extract<import('./RenderContext').DrawCommand, { kind: 'line' }>): void {
    const ctx = this.context;
    if (!ctx) return;
    const alpha = command.alpha * command.color.a;
    if (alpha <= 0) return;

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = BLEND_MODES[command.blend] ?? 'source-over';
    ctx.beginPath();
    ctx.moveTo(command.x1, command.y1);
    ctx.lineTo(command.x2, command.y2);
    ctx.strokeStyle = command.color.toCss();
    ctx.lineWidth = Math.max(0.1, command.width);
    ctx.stroke();
  }

  override dispose(): void {
    this.context = null;
    super.dispose();
  }
}
