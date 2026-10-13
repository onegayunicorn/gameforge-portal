import { Vector2 } from '../math/Vector2';
import type { Color } from '../math/Color';

/** Anything drawable as a texture by the Canvas2D and WebGL2 backends. */
export type TextureSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

let nextTextureId = 1;

/**
 * An image plus the metadata the renderer needs.
 *
 * Textures are reference-counted by AssetManager, but the renderer only ever reads them, so a
 * texture is immutable once constructed - replacing a texture means creating a new instance.
 */
export class Texture {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly source: TextureSource | null;
  readonly label: string;
  /** Populated when the texture is a plain colour rather than an image. */
  readonly solidColor: Color | null;
  private disposed = false;

  private constructor(
    source: TextureSource | null,
    width: number,
    height: number,
    label: string,
    solidColor: Color | null,
  ) {
    this.id = nextTextureId++;
    this.source = source;
    this.width = width;
    this.height = height;
    this.label = label;
    this.solidColor = solidColor;
  }

  /** Wrap a decoded image. Size is taken from the element unless overridden. */
  static fromSource(source: TextureSource, options: { label?: string; width?: number; height?: number } = {}): Texture {
    const width = options.width ?? (source as { width?: number }).width ?? 0;
    const height = options.height ?? (source as { height?: number }).height ?? 0;
    return new Texture(source, width, height, options.label ?? 'texture', null);
  }

  /**
   * Build a 1x1 texture of a flat colour. Used for untextured sprites and debug primitives so the
   * renderer has a single code path for "draw a quad".
   */
  static solid(color: Color, label: string = 'solid'): Texture {
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      if (ctx) {
        ctx.fillStyle = color.toCss();
        ctx.fillRect(0, 0, 1, 1);
        return new Texture(canvas as unknown as TextureSource, 1, 1, `${label}:${color.toHex()}`, color.clone());
      }
    }
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color.toCss();
        ctx.fillRect(0, 0, 1, 1);
        return new Texture(canvas, 1, 1, `${label}:${color.toHex()}`, color.clone());
      }
    }
    // Headless: no canvas available, keep the descriptor so tests can still assert sizing.
    return new Texture(null, 1, 1, `${label}:${color.toHex()}`, color.clone());
  }

  get size(): Vector2 {
    return new Vector2(this.width, this.height);
  }

  get aspect(): number {
    return this.height === 0 ? 1 : this.width / this.height;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Marks the texture unusable. The backing image is owned by the asset cache, not by us. */
  dispose(): void {
    this.disposed = true;
  }
}
