import { Color } from '../math/Color';
import { Rectangle } from '../math/Rectangle';
import type { Texture } from './Texture';

export type BlendMode = 'normal' | 'additive' | 'multiply';

export interface MaterialOptions {
  /** Tint multiplied into the texture, or the fill colour when there is no texture. */
  color?: Color | string | readonly number[];
  texture?: Texture | null;
  /** Sub-rectangle of the texture to sample, in texture pixels. */
  uv?: Rectangle | null;
  blend?: BlendMode;
  opacity?: number;
}

/**
 * How a drawable is painted.
 *
 * Materials are intentionally plain data: the WebGL2 backend can sort by material to batch draws
 * later without changing this shape.
 */
export class Material {
  readonly color: Color;
  texture: Texture | null;
  uv: Rectangle | null;
  blend: BlendMode;
  opacity: number;

  constructor(options: MaterialOptions = {}) {
    const { color } = options;
    this.color = typeof color === 'string'
      ? Color.fromHex(color)
      : Array.isArray(color)
        ? Color.fromArray(color as readonly number[])
        : color
          ? (color as Color).clone()
          : Color.WHITE.clone();
    this.texture = options.texture ?? null;
    this.uv = options.uv ?? null;
    this.blend = options.blend ?? 'normal';
    this.opacity = options.opacity ?? 1;
  }

  get isTextured(): boolean {
    return this.texture !== null && !this.texture.isDisposed;
  }

  /** Region of the texture to sample, defaulting to the whole texture. */
  get uvRect(): Rectangle | null {
    if (!this.texture) return null;
    return this.uv ?? new Rectangle(0, 0, this.texture.width, this.texture.height);
  }

  setColor(color: Color | string | readonly number[]): this {
    if (typeof color === 'string') this.color.copy(Color.fromHex(color));
    else if (Array.isArray(color)) this.color.copy(Color.fromArray(color as readonly number[]));
    else this.color.copy(color as Color);
    return this;
  }

  clone(): Material {
    return new Material({
      color: this.color,
      texture: this.texture,
      uv: this.uv ? this.uv.clone() : null,
      blend: this.blend,
      opacity: this.opacity,
    });
  }

  static solid(color: Color | string | readonly number[]): Material {
    return new Material({ color });
  }
}
