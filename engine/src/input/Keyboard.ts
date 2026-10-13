/**
 * Keyboard state.
 *
 * Keys are tracked by `KeyboardEvent.code` (physical position, layout-independent) and fall back
 * to `event.key` when the host does not provide a code. Edge sets are cleared by `endFrame()`,
 * which the engine calls once per simulation frame, so `wasPressed` is exactly "this frame".
 */
export class Keyboard {
  enabled = true;

  /** Keys whose default browser action is suppressed, e.g. Space scrolling the page. */
  readonly preventDefaultFor = new Set<string>();

  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly released = new Set<string>();
  private target: EventTarget | null = null;

  attach(target: EventTarget = globalThis as unknown as EventTarget): void {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    target.addEventListener('keydown', this.handleKeyDown as EventListener);
    target.addEventListener('keyup', this.handleKeyUp as EventListener);
    // Losing focus mid-press would otherwise leave keys stuck down forever.
    target.addEventListener('blur', this.handleBlur as EventListener);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.handleKeyUp as EventListener);
    this.target.removeEventListener('blur', this.handleBlur as EventListener);
    this.target = null;
    this.reset();
  }

  private static codeOf(event: KeyboardEvent): string {
    return event.code && event.code.length > 0 ? event.code : event.key;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    const code = Keyboard.codeOf(event);
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
    if (this.preventDefaultFor.has(code)) event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    const code = Keyboard.codeOf(event);
    this.down.delete(code);
    this.released.add(code);
    if (this.preventDefaultFor.has(code)) event.preventDefault();
  };

  private readonly handleBlur = (): void => {
    this.reset();
  };

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  wasReleased(code: string): boolean {
    return this.released.has(code);
  }

  /** Every key currently held. */
  get heldKeys(): string[] {
    return Array.from(this.down);
  }

  get anyKeyDown(): boolean {
    return this.down.size > 0;
  }

  /** Clear per-frame edge state. Called by `Input.endFrame()`. */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
  }

  /** Drop all state, including held keys. */
  reset(): void {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }
}
