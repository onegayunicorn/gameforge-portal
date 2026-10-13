import { Vector2 } from './Vector2';
import { clamp } from './MathUtils';

/** Axis-aligned rectangle in top-left origin space (the convention used by the 2D renderer). */
export class Rectangle {
  static fromPoints(a: Vector2, b: Vector2): Rectangle {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return new Rectangle(x, y, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  constructor(
    public x: number = 0,
    public y: number = 0,
    public width: number = 0,
    public height: number = 0,
  ) {}

  set(x: number, y: number, width: number, height: number): this {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }

  copy(other: Rectangle): this {
    return this.set(other.x, other.y, other.width, other.height);
  }

  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }

  get left(): number { return this.x; }
  get top(): number { return this.y; }
  get right(): number { return this.x + this.width; }
  get bottom(): number { return this.y + this.height; }
  get centerX(): number { return this.x + this.width / 2; }
  get centerY(): number { return this.y + this.height / 2; }
  get area(): number { return this.width * this.height; }
  get isEmpty(): boolean { return this.width <= 0 || this.height <= 0; }

  get center(): Vector2 {
    return new Vector2(this.centerX, this.centerY);
  }

  get position(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  get size(): Vector2 {
    return new Vector2(this.width, this.height);
  }

  containsPoint(point: Vector2): boolean {
    return point.x >= this.x && point.x < this.right && point.y >= this.y && point.y < this.bottom;
  }

  containsRect(other: Rectangle): boolean {
    return other.x >= this.x && other.right <= this.right && other.y >= this.y && other.bottom <= this.bottom;
  }

  intersects(other: Rectangle): boolean {
    return !(
      other.x >= this.right ||
      other.right <= this.x ||
      other.y >= this.bottom ||
      other.bottom <= this.y
    );
  }

  /** Overlap area, or null when the rectangles do not intersect. */
  intersection(other: Rectangle): Rectangle | null {
    if (!this.intersects(other)) return null;
    const x = Math.max(this.x, other.x);
    const y = Math.max(this.y, other.y);
    return new Rectangle(
      x,
      y,
      Math.min(this.right, other.right) - x,
      Math.min(this.bottom, other.bottom) - y,
    );
  }

  union(other: Rectangle): Rectangle {
    const x = Math.min(this.x, other.x);
    const y = Math.min(this.y, other.y);
    return new Rectangle(
      x,
      y,
      Math.max(this.right, other.right) - x,
      Math.max(this.bottom, other.bottom) - y,
    );
  }

  inflate(amountX: number, amountY: number = amountX): this {
    this.x -= amountX;
    this.y -= amountY;
    this.width += amountX * 2;
    this.height += amountY * 2;
    return this;
  }

  /** Shift so the rectangle is inside `bounds`, keeping its size when it fits. */
  clampTo(bounds: Rectangle): this {
    const maxX = bounds.width <= this.width ? bounds.x : bounds.right - this.width;
    const maxY = bounds.height <= this.height ? bounds.y : bounds.bottom - this.height;
    this.x = clamp(this.x, bounds.x, Math.max(bounds.x, maxX));
    this.y = clamp(this.y, bounds.y, Math.max(bounds.y, maxY));
    return this;
  }

  equals(other: Rectangle, tolerance: number = 0): boolean {
    return (
      Math.abs(this.x - other.x) <= tolerance &&
      Math.abs(this.y - other.y) <= tolerance &&
      Math.abs(this.width - other.width) <= tolerance &&
      Math.abs(this.height - other.height) <= tolerance
    );
  }

  toJSON(): { x: number; y: number; width: number; height: number } {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  toString(): string {
    return `Rectangle(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
  }
}
