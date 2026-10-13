import { Vector2 } from '../math/Vector2';
import { Keyboard } from './Keyboard';
import { Mouse } from './Mouse';
import { Touch } from './Touch';
import { InputMap } from './InputMap';
import type { Camera } from '../renderer/Camera';

export interface InputAttachOptions {
  /** Event target for keyboard events. Defaults to the window. */
  keyboardTarget?: EventTarget;
  /** Event target for pointer events. Defaults to the canvas element when present. */
  pointerTarget?: EventTarget;
  /** Element used to convert client coordinates into local pixels. */
  element?: HTMLElement | null;
  /** Suppress browser scrolling/zooming gestures over the canvas. */
  preventDefault?: boolean;
}

/**
 * Aggregates the input devices and exposes the action map.
 *
 * Input is sampled, not event-driven, from the game's point of view: systems read `isDown` /
 * `wasPressed` during their update, and the engine calls `endFrame()` after the simulation step so
 * "pressed" means "pressed during this step".
 */
export class Input {
  readonly keyboard = new Keyboard();
  readonly mouse = new Mouse();
  readonly touch = new Touch();
  readonly map: InputMap;

  /** Camera used to convert pointer positions into world space. Set by the Engine. */
  camera: Camera | null = null;

  private attached = false;
  private readonly worldPointer = new Vector2();

  constructor(map?: InputMap) {
    this.map = map ?? new InputMap(this);
  }

  attach(options: InputAttachOptions = {}): void {
    if (this.attached) return;
    const keyboardTarget = options.keyboardTarget
      ?? (typeof window !== 'undefined' ? (window as unknown as EventTarget) : undefined);
    const pointerTarget = options.pointerTarget
      ?? options.element
      ?? (typeof window !== 'undefined' ? (window as unknown as EventTarget) : undefined);

    if (keyboardTarget) {
      this.keyboard.attach(keyboardTarget);
      // Space and the arrows scroll the page; a game almost never wants that.
      this.keyboard.preventDefaultFor.add('Space');
      this.keyboard.preventDefaultFor.add('ArrowUp');
      this.keyboard.preventDefaultFor.add('ArrowDown');
      this.keyboard.preventDefaultFor.add('ArrowLeft');
      this.keyboard.preventDefaultFor.add('ArrowRight');
    }
    if (pointerTarget) {
      this.mouse.attach(pointerTarget, { element: options.element ?? null });
      this.touch.attach(pointerTarget, {
        element: options.element ?? null,
        preventDefault: options.preventDefault ?? false,
      });
    }
    this.attached = true;
  }

  detach(): void {
    this.keyboard.detach();
    this.mouse.detach();
    this.touch.detach();
    this.attached = false;
  }

  get isAttached(): boolean {
    return this.attached;
  }

  isKeyDown(code: string): boolean {
    return this.keyboard.isDown(code);
  }

  wasKeyPressed(code: string): boolean {
    return this.keyboard.wasPressed(code);
  }

  isMouseButtonDown(button: number = 0): boolean {
    return this.mouse.isButtonDown(button);
  }

  wasMouseButtonPressed(button: number = 0): boolean {
    return this.mouse.wasButtonPressed(button);
  }

  /** Pointer position in element-local pixels. */
  get pointer(): Vector2 {
    return this.mouse.position;
  }

  /**
   * Pointer position in world space, using the assigned camera. Falls back to the raw pixel
   * position when no camera is set, so calling it headlessly never throws.
   */
  pointerWorld(out: Vector2 = this.worldPointer): Vector2 {
    if (!this.camera) return out.copy(this.mouse.position);
    return this.camera.screenToWorld(this.mouse.position, out);
  }

  get isActionDown(): (action: string) => boolean {
    return (action: string) => this.map.isDown(action);
  }

  reset(): void {
    this.keyboard.reset();
    this.mouse.reset();
    this.touch.reset();
  }

  /** Clear per-frame edge state across every device. Called by the Engine each step. */
  endFrame(): void {
    this.keyboard.endFrame();
    this.mouse.endFrame();
    this.touch.endFrame();
  }
}
