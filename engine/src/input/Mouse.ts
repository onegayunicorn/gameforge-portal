import { Vector2 } from '../math/Vector2';

export interface MouseAttachOptions {
  /** Element used to convert client coordinates into local pixels. Defaults to the target. */
  element?: HTMLElement | null;
  /** Capture the pointer over the element so drags outside it keep reporting. */
  captureOnDown?: boolean;
}

/**
 * Pointer (mouse) state.
 *
 * Position is reported in element-local CSS pixels; `Input` converts that to world space through
 * the active camera. Wheel deltas are accumulated and cleared each frame.
 */
export class Mouse {
  enabled = true;

  readonly position = new Vector2(0, 0);
  readonly delta = new Vector2(0, 0);
  wheelDelta = 0;

  private readonly down = new Set<number>();
  private readonly pressed = new Set<number>();
  private readonly released = new Set<number>();
  private target: EventTarget | null = null;
  private element: HTMLElement | null = null;
  private captureOnDown = false;
  private inside = false;

  attach(target: EventTarget = globalThis as unknown as EventTarget, options: MouseAttachOptions = {}): void {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    this.element = options.element ?? (target as HTMLElement | null);
    this.captureOnDown = options.captureOnDown ?? false;

    target.addEventListener('mousemove', this.handleMove as EventListener);
    target.addEventListener('mousedown', this.handleDown as EventListener);
    target.addEventListener('mouseup', this.handleUp as EventListener);
    target.addEventListener('wheel', this.handleWheel as EventListener, { passive: false });
    target.addEventListener('mouseleave', this.handleLeave as EventListener);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('mousemove', this.handleMove as EventListener);
    this.target.removeEventListener('mousedown', this.handleDown as EventListener);
    this.target.removeEventListener('mouseup', this.handleUp as EventListener);
    this.target.removeEventListener('wheel', this.handleWheel as EventListener);
    this.target.removeEventListener('mouseleave', this.handleLeave as EventListener);
    this.target = null;
    this.element = null;
    this.reset();
  }

  private updatePosition(clientX: number, clientY: number): void {
    const element = this.element;
    let x = clientX;
    let y = clientY;
    if (element && typeof element.getBoundingClientRect === 'function') {
      const rect = element.getBoundingClientRect();
      x -= rect.left;
      y -= rect.top;
    }
    this.delta.set(x - this.position.x, y - this.position.y);
    this.position.set(x, y);
  }

  private readonly handleMove = (event: MouseEvent): void => {
    if (!this.enabled) return;
    this.inside = true;
    this.updatePosition(event.clientX, event.clientY);
  };

  private readonly handleDown = (event: MouseEvent): void => {
    if (!this.enabled) return;
    this.updatePosition(event.clientX, event.clientY);
    if (!this.down.has(event.button)) this.pressed.add(event.button);
    this.down.add(event.button);
    // Pointer capture only exists on PointerEvent; MouseEvent has no pointerId.
    const pointerId = (event as PointerEvent).pointerId;
    if (this.captureOnDown && this.element?.setPointerCapture && typeof pointerId === 'number') {
      try {
        this.element.setPointerCapture(pointerId);
      } catch {
        // Pointer capture is best-effort; a failure must not break input.
      }
    }
  };

  private readonly handleUp = (event: MouseEvent): void => {
    if (!this.enabled) return;
    this.updatePosition(event.clientX, event.clientY);
    this.down.delete(event.button);
    this.released.add(event.button);
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.enabled) return;
    this.wheelDelta += event.deltaY;
    if (event.cancelable) event.preventDefault();
  };

  private readonly handleLeave = (): void => {
    this.inside = false;
  };

  /** Left button, the common case, so callers can avoid magic numbers. */
  get isPrimaryDown(): boolean {
    return this.down.has(0);
  }

  isButtonDown(button: number): boolean {
    return this.down.has(button);
  }

  wasButtonPressed(button: number): boolean {
    return this.pressed.has(button);
  }

  wasButtonReleased(button: number): boolean {
    return this.released.has(button);
  }

  get isInside(): boolean {
    return this.inside;
  }

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.delta.set(0, 0);
    this.wheelDelta = 0;
  }

  reset(): void {
    this.down.clear();
    this.endFrame();
  }
}
