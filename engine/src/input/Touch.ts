import { Vector2 } from '../math/Vector2';

export interface TouchPoint {
  id: number;
  position: Vector2;
  startPosition: Vector2;
  /** Movement since the touch began, in local pixels. */
  delta: Vector2;
}

export interface TouchAttachOptions {
  element?: HTMLElement | null;
  /** Suppress default scrolling/zooming gestures over the element. */
  preventDefault?: boolean;
}

/**
 * Multi-touch state.
 *
 * Tracked per touch identifier so a virtual thumbstick and a jump button can be held at once. As
 * with the other devices, edge state is cleared by `endFrame()`.
 */
export class Touch {
  enabled = true;

  private readonly activeTouches = new Map<number, TouchPoint>();
  private readonly started = new Set<number>();
  private readonly ended = new Set<number>();
  private target: EventTarget | null = null;
  private element: HTMLElement | null = null;
  private preventDefaultBehaviour = false;

  attach(target: EventTarget = globalThis as unknown as EventTarget, options: TouchAttachOptions = {}): void {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    this.element = options.element ?? (target as HTMLElement | null);
    this.preventDefaultBehaviour = options.preventDefault ?? false;

    target.addEventListener('touchstart', this.handleStart as EventListener, { passive: !this.preventDefaultBehaviour });
    target.addEventListener('touchmove', this.handleMove as EventListener, { passive: !this.preventDefaultBehaviour });
    target.addEventListener('touchend', this.handleEnd as EventListener);
    target.addEventListener('touchcancel', this.handleEnd as EventListener);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('touchstart', this.handleStart as EventListener);
    this.target.removeEventListener('touchmove', this.handleMove as EventListener);
    this.target.removeEventListener('touchend', this.handleEnd as EventListener);
    this.target.removeEventListener('touchcancel', this.handleEnd as EventListener);
    this.target = null;
    this.element = null;
    this.reset();
  }

  private localPoint(clientX: number, clientY: number): Vector2 {
    const element = this.element;
    if (!element || typeof element.getBoundingClientRect !== 'function') return new Vector2(clientX, clientY);
    const rect = element.getBoundingClientRect();
    return new Vector2(clientX - rect.left, clientY - rect.top);
  }

  private readonly handleStart = (event: TouchEvent): void => {
    if (!this.enabled) return;
    if (this.preventDefaultBehaviour && event.cancelable) event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) {
      const point = this.localPoint(touch.clientX, touch.clientY);
      this.activeTouches.set(touch.identifier, {
        id: touch.identifier,
        position: point,
        startPosition: point.clone(),
        delta: new Vector2(0, 0),
      });
      this.started.add(touch.identifier);
    }
  };

  private readonly handleMove = (event: TouchEvent): void => {
    if (!this.enabled) return;
    if (this.preventDefaultBehaviour && event.cancelable) event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) {
      const existing = this.activeTouches.get(touch.identifier);
      if (!existing) continue;
      const point = this.localPoint(touch.clientX, touch.clientY);
      existing.position.copy(point);
      existing.delta.set(point.x - existing.startPosition.x, point.y - existing.startPosition.y);
    }
  };

  private readonly handleEnd = (event: TouchEvent): void => {
    if (!this.enabled) return;
    for (const touch of Array.from(event.changedTouches)) {
      if (this.activeTouches.delete(touch.identifier)) this.ended.add(touch.identifier);
    }
  };

  get touchCount(): number {
    return this.activeTouches.size;
  }

  get isTouching(): boolean {
    return this.activeTouches.size > 0;
  }

  /** First active touch, or null. Most games only care about one finger. */
  get primary(): TouchPoint | null {
    for (const point of this.activeTouches.values()) return point;
    return null;
  }

  getAll(): TouchPoint[] {
    return Array.from(this.activeTouches.values());
  }

  wasStarted(id?: number): boolean {
    if (id === undefined) return this.started.size > 0;
    return this.started.has(id);
  }

  wasEnded(id?: number): boolean {
    if (id === undefined) return this.ended.size > 0;
    return this.ended.has(id);
  }

  /** True when a touch began this frame and has not moved far - a tap rather than a drag. */
  wasTapped(maxTravel: number = 12): boolean {
    for (const id of this.started) {
      const point = this.activeTouches.get(id);
      if (point && point.position.distanceTo(point.startPosition) <= maxTravel) return true;
    }
    return false;
  }

  endFrame(): void {
    this.started.clear();
    this.ended.clear();
  }

  reset(): void {
    this.activeTouches.clear();
    this.endFrame();
  }
}
