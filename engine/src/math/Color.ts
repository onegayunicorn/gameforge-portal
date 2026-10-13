import { clamp01 } from './MathUtils';

/**
 * RGBA colour with normalised 0..1 channels.
 *
 * Kept immutable-by-convention for the common literals (`Color.WHITE`) but exposes mutating
 * helpers for hot paths, mirroring Vector2's design.
 */
export class Color {
  static readonly TRANSPARENT = Object.freeze(new Color(0, 0, 0, 0));
  static readonly BLACK = Object.freeze(new Color(0, 0, 0, 1));
  static readonly WHITE = Object.freeze(new Color(1, 1, 1, 1));
  static readonly RED = Object.freeze(new Color(1, 0, 0, 1));
  static readonly GREEN = Object.freeze(new Color(0, 1, 0, 1));
  static readonly BLUE = Object.freeze(new Color(0, 0, 1, 1));
  static readonly YELLOW = Object.freeze(new Color(1, 1, 0, 1));

  constructor(
    public r: number = 1,
    public g: number = 1,
    public b: number = 1,
    public a: number = 1,
  ) {}

  /** Parse `#rgb`, `#rrggbb`, `#rrggbbaa` or a `rgb()/rgba()` string. */
  static fromHex(hex: string): Color {
    const text = hex.trim().replace(/^#/, '');

    if (/^[0-9a-f]{3}$/i.test(text) || /^[0-9a-f]{4}$/i.test(text)) {
      const [r, g, b, a] = text.split('');
      return new Color(
        parseInt(r + r, 16) / 255,
        parseInt(g + g, 16) / 255,
        parseInt(b + b, 16) / 255,
        a ? parseInt(a + a, 16) / 255 : 1,
      );
    }

    if (/^[0-9a-f]{6}$/i.test(text) || /^[0-9a-f]{8}$/i.test(text)) {
      return new Color(
        parseInt(text.slice(0, 2), 16) / 255,
        parseInt(text.slice(2, 4), 16) / 255,
        parseInt(text.slice(4, 6), 16) / 255,
        text.length === 8 ? parseInt(text.slice(6, 8), 16) / 255 : 1,
      );
    }

    const match = /^rgba?\(([^)]+)\)$/i.exec(hex.trim());
    if (match) {
      const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()));
      const [r = 0, g = 0, b = 0, a = 1] = parts;
      return new Color(
        clamp01(r > 1 ? r / 255 : r),
        clamp01(g > 1 ? g / 255 : g),
        clamp01(b > 1 ? b / 255 : b),
        clamp01(a),
      );
    }

    throw new Error(`Color.fromHex: unsupported colour string "${hex}"`);
  }

  /** Parse a float RGBA tuple as written in scene files: `[1, 0.5, 0, 1]`. */
  static fromArray(values: readonly number[]): Color {
    return new Color(values[0] ?? 1, values[1] ?? 1, values[2] ?? 1, values[3] ?? 1);
  }

  static lerp(a: Color, b: Color, t: number): Color {
    return new Color(
      a.r + (b.r - a.r) * t,
      a.g + (b.g - a.g) * t,
      a.b + (b.b - a.b) * t,
      a.a + (b.a - a.a) * t,
    );
  }

  set(r: number, g: number, b: number, a: number = this.a): this {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
    return this;
  }

  copy(other: Color): this {
    return this.set(other.r, other.g, other.b, other.a);
  }

  clone(): Color {
    return new Color(this.r, this.g, this.b, this.a);
  }

  /** Multiply channels in place - used for tinting. */
  multiply(other: Color): this {
    this.r *= other.r;
    this.g *= other.g;
    this.b *= other.b;
    this.a *= other.a;
    return this;
  }

  withAlpha(alpha: number): this {
    this.a = clamp01(alpha);
    return this;
  }

  equals(other: Color): boolean {
    return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
  }

  toArray(): [number, number, number, number] {
    return [this.r, this.g, this.b, this.a];
  }

  toHex(includeAlpha: boolean = false): string {
    const channel = (value: number) =>
      Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
    const base = `#${channel(this.r)}${channel(this.g)}${channel(this.b)}`;
    return includeAlpha ? `${base}${channel(this.a)}` : base;
  }

  /** Canvas/WebGL-ready string. */
  toCss(): string {
    const c = (v: number) => Math.round(clamp01(v) * 255);
    return `rgba(${c(this.r)}, ${c(this.g)}, ${c(this.b)}, ${clamp01(this.a)})`;
  }

  toJSON(): [number, number, number, number] {
    return this.toArray();
  }

  toString(): string {
    return `Color(${this.toHex(true)})`;
  }
}
