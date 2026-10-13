import { Vector2 } from '../math/Vector2';
import { degToRad } from '../math/MathUtils';
import type { Component } from '../core/Component';
import type { EntityId } from '../core/Entity';

/**
 * Position, rotation and scale in scene space.
 *
 * Local values are authoritative; `worldPosition`/`worldRotation`/`worldScale` are derived by
 * TransformSystem each simulation step and must not be written to by game code.
 */
export class Transform implements Component {
  static readonly componentName = 'Transform';

  readonly position = new Vector2(0, 0);
  readonly scale = new Vector2(1, 1);
  /** Rotation in radians. */
  rotation = 0;

  /** Optional parent entity, resolved by TransformSystem when it is set. */
  parent: EntityId | null = null;
  /** Direct children, maintained by TransformSystem. */
  readonly children: EntityId[] = [];

  /** Render ordering within a layer: higher draws on top. */
  zIndex = 0;

  // ---- derived (written by TransformSystem) ----
  readonly worldPosition = new Vector2(0, 0);
  readonly worldScale = new Vector2(1, 1);
  worldRotation = 0;
  private dirty = true;

  constructor(position?: Vector2 | { x: number; y: number }, rotation?: number, scale?: Vector2) {
    if (position) this.position.copy(Vector2.from(position));
    if (rotation !== undefined) this.rotation = rotation;
    if (scale) this.scale.copy(scale);
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  /** Flag local values as changed so the derived transform is recomputed. */
  markDirty(): this {
    this.dirty = true;
    return this;
  }

  /** Called by TransformSystem once the world transform has been recomputed. */
  clearDirty(): void {
    this.dirty = false;
  }

  setPosition(x: number, y: number): this {
    this.position.set(x, y);
    return this.markDirty();
  }

  setRotation(radians: number): this {
    this.rotation = radians;
    return this.markDirty();
  }

  /** Rotation helper for designers: degrees in, radians stored. */
  setRotationDegrees(degrees: number): this {
    return this.setRotation(degToRad(degrees));
  }

  setScale(x: number, y: number = x): this {
    this.scale.set(x, y);
    return this.markDirty();
  }

  translate(x: number, y: number): this {
    this.position.x += x;
    this.position.y += y;
    return this.markDirty();
  }

  rotate(radians: number): this {
    this.rotation += radians;
    return this.markDirty();
  }

  /** World-space rotation of a local direction. */
  rotatePoint(point: Vector2, out: Vector2 = new Vector2()): Vector2 {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return out.set(point.x * cos - point.y * sin, point.x * sin + point.y * cos);
  }

  toJSON(): { position: [number, number]; rotation: number; scale: [number, number]; zIndex: number } {
    return {
      position: this.position.toArray(),
      rotation: this.rotation,
      scale: this.scale.toArray(),
      zIndex: this.zIndex,
    };
  }

  static fromJSON(data: {
    position?: [number, number] | { x: number; y: number };
    rotation?: number;
    scale?: [number, number] | { x: number; y: number };
    zIndex?: number;
  }): Transform {
    const transform = new Transform();
    if (data.position) transform.position.copy(Vector2.from(data.position));
    if (data.rotation !== undefined) transform.rotation = data.rotation;
    if (data.scale) transform.scale.copy(Vector2.from(data.scale));
    if (data.zIndex !== undefined) transform.zIndex = data.zIndex;
    return transform;
  }
}
