import { Color } from '../math/Color';
import { Rectangle } from '../math/Rectangle';
import { circle } from '../renderer/primitives/Circle';
import { line } from '../renderer/primitives/Line';
import type { EntityId } from '../core/Entity';
import type { RenderQueue } from '../renderer/RenderQueue';
import type { DrawCommand } from '../renderer/RenderContext';

/**
 * Immediate-mode debug overlay.
 *
 * Game and system code call the shape helpers each frame; RenderSystem flushes whatever was
 * collected. Everything lands on a high layer so it sits above the scene, and nothing is retained
 * between frames.
 */
export class DebugDraw {
  enabled: boolean;
  color: Color = Color.fromHex('#4ed6b8');
  lineWidth = 1;
  layer = 10_000;

  private readonly commands: DrawCommand[] = [];

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  get count(): number {
    return this.commands.length;
  }

  line(x1: number, y1: number, x2: number, y2: number, color?: Color): void {
    if (!this.enabled) return;
    this.commands.push(line({ x1, y1, x2, y2, color: color ?? this.color, width: this.lineWidth, layer: this.layer }));
  }

  rect(bounds: Rectangle, color?: Color): void {
    if (!this.enabled) return;
    const c = color ?? this.color;
    this.line(bounds.left, bounds.top, bounds.right, bounds.top, c);
    this.line(bounds.right, bounds.top, bounds.right, bounds.bottom, c);
    this.line(bounds.right, bounds.bottom, bounds.left, bounds.bottom, c);
    this.line(bounds.left, bounds.bottom, bounds.left, bounds.top, c);
  }

  circle(x: number, y: number, radius: number, color?: Color): void {
    if (!this.enabled) return;
    this.commands.push(circle({
      x,
      y,
      radius,
      color: color ?? this.color,
      filled: false,
      lineWidth: this.lineWidth,
      layer: this.layer,
    }));
  }

  /** Crosshair marker at a point. */
  cross(x: number, y: number, size: number = 4, color?: Color): void {
    if (!this.enabled) return;
    const c = color ?? this.color;
    this.line(x - size, y, x + size, y, c);
    this.line(x, y - size, x, y + size, c);
  }

  /** Label a point with its entity id - handy when inspecting a live scene. */
  entityMarker(id: EntityId, x: number, y: number, size: number = 6): void {
    if (!this.enabled) return;
    this.cross(x, y, size);
    this.circle(x, y, size, Color.fromHex('#b78cff'));
    void id;
  }

  /** Hand collected commands to the render queue. Called once per render frame. */
  flushTo(queue: RenderQueue): number {
    if (this.commands.length === 0) return 0;
    const flushed = this.commands.length;
    for (const command of this.commands) queue.add(command);
    this.commands.length = 0;
    return flushed;
  }

  clear(): void {
    this.commands.length = 0;
  }
}
