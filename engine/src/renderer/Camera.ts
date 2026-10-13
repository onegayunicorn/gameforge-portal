import { Vector2 } from '../math/Vector2';
import { Rectangle } from '../math/Rectangle';
import { clamp } from '../math/MathUtils';
import type { Component } from '../core/Component';
import type { Transform } from '../scene/Transform';

export interface CameraFollowOptions {
  /** 0 snaps to the target every frame; higher values smooth the follow. */
  smoothing?: number;
  /** Offset applied in the target's local space. */
  offset?: Vector2;
}

/**
 * Orthographic 2D camera.
 *
 * The renderer reads the camera's transform when it begins a frame; game code never issues raw
 * canvas transforms, which keeps world/screen conversion in exactly one place.
 */
export class Camera implements Component {
  static readonly componentName = 'Camera';

  /** Centre of the visible area, in world units. */
  readonly position = new Vector2(0, 0);
  zoom = 1;
  /** Rotation in radians. */
  rotation = 0;
  isMain = true;
  viewportWidth = 0;
  viewportHeight = 0;

  private followTarget: Transform | null = null;
  private followSmoothing = 0;
  private readonly followOffset = new Vector2(0, 0);

  constructor(position?: Vector2 | { x: number; y: number }) {
    if (position) this.position.copy(Vector2.from(position));
  }

  setViewport(width: number, height: number): this {
    this.viewportWidth = width;
    this.viewportHeight = height;
    return this;
  }

  setPosition(x: number, y: number): this {
    this.position.set(x, y);
    return this;
  }

  setZoom(zoom: number): this {
    this.zoom = Math.max(0.01, zoom);
    return this;
  }

  /** Continuously track a transform, optionally with smoothing. */
  follow(target: Transform, options: CameraFollowOptions = {}): this {
    this.followTarget = target;
    this.followSmoothing = Math.max(0, options.smoothing ?? 0);
    this.followOffset.copy(options.offset ?? Vector2.ZERO);
    if (this.followSmoothing === 0) this.snapToTarget();
    return this;
  }

  stopFollowing(): this {
    this.followTarget = null;
    return this;
  }

  private snapToTarget(): void {
    if (!this.followTarget) return;
    this.position.set(this.followTarget.worldPosition.x, this.followTarget.worldPosition.y).add(this.followOffset);
  }

  /** Advance a smoothed follow. Safe to call every frame whether or not a target is set. */
  update(deltaSeconds: number): void {
    if (!this.followTarget) return;
    const targetX = this.followTarget.worldPosition.x + this.followOffset.x;
    const targetY = this.followTarget.worldPosition.y + this.followOffset.y;
    if (this.followSmoothing === 0) {
      this.position.set(targetX, targetY);
      return;
    }
    // Frame-rate independent exponential smoothing.
    const t = 1 - Math.exp(-this.followSmoothing * deltaSeconds);
    this.position.set(this.position.x + (targetX - this.position.x) * t, this.position.y + (targetY - this.position.y) * t);
  }

  /** Half-extents of the visible world area. */
  get visibleHalfExtents(): Vector2 {
    const zoom = this.zoom <= 0 ? 1 : this.zoom;
    return new Vector2(this.viewportWidth / (2 * zoom), this.viewportHeight / (2 * zoom));
  }

  /** World-space rectangle currently visible, expanded for rotation. */
  visibleBounds(out: Rectangle = new Rectangle()): Rectangle {
    const half = this.visibleHalfExtents;
    const cos = Math.abs(Math.cos(this.rotation));
    const sin = Math.abs(Math.sin(this.rotation));
    const extentX = half.x * cos + half.y * sin;
    const extentY = half.x * sin + half.y * cos;
    return out.set(
      this.position.x - extentX,
      this.position.y - extentY,
      extentX * 2,
      extentY * 2,
    );
  }

  /** Convert a world point into viewport pixels (top-left origin). */
  worldToScreen(world: Vector2, out: Vector2 = new Vector2()): Vector2 {
    const dx = world.x - this.position.x;
    const dy = world.y - this.position.y;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return out.set(rx * this.zoom + this.viewportWidth / 2, ry * this.zoom + this.viewportHeight / 2);
  }

  /** Convert viewport pixels into a world point. Inverse of `worldToScreen`. */
  screenToWorld(screen: Vector2, out: Vector2 = new Vector2()): Vector2 {
    const sx = (screen.x - this.viewportWidth / 2) / (this.zoom <= 0 ? 1 : this.zoom);
    const sy = (screen.y - this.viewportHeight / 2) / (this.zoom <= 0 ? 1 : this.zoom);
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return out.set(this.position.x + sx * cos - sy * sin, this.position.y + sx * sin + sy * cos);
  }

  /** Visibility test used to skip off-screen sprites. */
  isVisible(bounds: Rectangle): boolean {
    return this.visibleBounds().intersects(bounds);
  }

  /** Fit a zoom so `worldSize` fills the viewport, clamped to sensible limits. */
  fit(worldSize: Vector2, padding: number = 0): this {
    if (worldSize.x <= 0 || worldSize.y <= 0 || this.viewportWidth <= 0 || this.viewportHeight <= 0) return this;
    const zoom = Math.min(
      this.viewportWidth / (worldSize.x + padding * 2),
      this.viewportHeight / (worldSize.y + padding * 2),
    );
    return this.setZoom(clamp(zoom, 0.01, 100));
  }

  toJSON(): { position: [number, number]; zoom: number; rotation: number; isMain: boolean } {
    return {
      position: this.position.toArray(),
      zoom: this.zoom,
      rotation: this.rotation,
      isMain: this.isMain,
    };
  }
}
