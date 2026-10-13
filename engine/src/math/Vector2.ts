import { EPSILON, clamp, lerp } from './MathUtils';

/**
 * Mutable 2D vector.
 *
 * Methods mutate `this` and return it so hot loops stay allocation-free; use `clone()` when a
 * copy is genuinely needed. Static helpers (`Vector2.add(a, b)`) never allocate either.
 */
export class Vector2 {
  static readonly ZERO: Readonly<Vector2> = Object.freeze(new Vector2(0, 0));
  static readonly ONE: Readonly<Vector2> = Object.freeze(new Vector2(1, 1));
  static readonly UP: Readonly<Vector2> = Object.freeze(new Vector2(0, -1));
  static readonly DOWN: Readonly<Vector2> = Object.freeze(new Vector2(0, 1));
  static readonly LEFT: Readonly<Vector2> = Object.freeze(new Vector2(-1, 0));
  static readonly RIGHT: Readonly<Vector2> = Object.freeze(new Vector2(1, 0));

  constructor(public x: number = 0, public y: number = 0) {}

  static from(value: { x: number; y: number } | [number, number] | number, y?: number): Vector2 {
    if (typeof value === 'number') return new Vector2(value, y ?? value);
    if (Array.isArray(value)) return new Vector2(value[0] ?? 0, value[1] ?? 0);
    return new Vector2(value.x, value.y);
  }

  static add(a: Vector2, b: Vector2, out: Vector2 = new Vector2()): Vector2 {
    return out.set(a.x + b.x, a.y + b.y);
  }

  static sub(a: Vector2, b: Vector2, out: Vector2 = new Vector2()): Vector2 {
    return out.set(a.x - b.x, a.y - b.y);
  }

  static scale(a: Vector2, scalar: number, out: Vector2 = new Vector2()): Vector2 {
    return out.set(a.x * scalar, a.y * scalar);
  }

  static dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y;
  }

  /** 2D cross product: the z component of the 3D cross of (a, 0) and (b, 0). */
  static cross(a: Vector2, b: Vector2): number {
    return a.x * b.y - a.y * b.x;
  }

  static distance(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  static distanceSquared(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  static lerp(a: Vector2, b: Vector2, t: number, out: Vector2 = new Vector2()): Vector2 {
    return out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(other: Vector2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  add(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  addScaled(other: Vector2, scalar: number): this {
    this.x += other.x * scalar;
    this.y += other.y * scalar;
    return this;
  }

  sub(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  multiply(other: Vector2): this {
    this.x *= other.x;
    this.y *= other.y;
    return this;
  }

  negate(): this {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }

  /** Clamp each component into [min, max]. */
  clamp(min: number, max: number): this {
    this.x = clamp(this.x, min, max);
    this.y = clamp(this.y, min, max);
    return this;
  }

  /** Clamp to unit length while preserving direction; zero stays zero. */
  limit(maxLength: number): this {
    const lengthSq = this.lengthSquared;
    if (lengthSq > maxLength * maxLength && lengthSq > 0) {
      this.scale(maxLength / Math.sqrt(lengthSq));
    }
    return this;
  }

  normalize(): this {
    const length = this.length;
    if (length > EPSILON) this.scale(1 / length);
    return this;
  }

  /** Move this point towards `target` by at most `maxDistance`. */
  moveTowards(target: Vector2, maxDistance: number): this {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= maxDistance || distance < EPSILON) return this.copy(target);
    return this.set(this.x + (dx / distance) * maxDistance, this.y + (dy / distance) * maxDistance);
  }

  rotate(radians: number): this {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const x = this.x * cos - this.y * sin;
    const y = this.x * sin + this.y * cos;
    return this.set(x, y);
  }

  /** Rotate around an arbitrary pivot rather than the origin. */
  rotateAround(pivot: Vector2, radians: number): this {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = this.x - pivot.x;
    const dy = this.y - pivot.y;
    return this.set(pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos);
  }

  get lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  get length(): number {
    return Math.hypot(this.x, this.y);
  }

  /** Rotation of this vector in radians (atan2, so -PI..PI). */
  get angle(): number {
    return Math.atan2(this.y, this.x);
  }

  distanceTo(other: Vector2): number {
    return Vector2.distance(this, other);
  }

  distanceToSquared(other: Vector2): number {
    return Vector2.distanceSquared(this, other);
  }

  dot(other: Vector2): number {
    return Vector2.dot(this, other);
  }

  cross(other: Vector2): number {
    return Vector2.cross(this, other);
  }

  equals(other: Vector2, tolerance: number = 0): boolean {
    if (tolerance === 0) return this.x === other.x && this.y === other.y;
    return Math.abs(this.x - other.x) <= tolerance && Math.abs(this.y - other.y) <= tolerance;
  }

  /** True when both components are finite numbers. */
  get isFinite(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y);
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  toString(): string {
    return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
}
