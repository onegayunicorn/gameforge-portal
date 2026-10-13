import type { Input } from './Input';

export type BindingSource = 'key' | 'mouse' | 'touch';

export interface Binding {
  source: BindingSource;
  /** Key code for `key` bindings, button index for `mouse`, ignored for `touch`. */
  code: string | number;
}

export interface AxisBinding {
  negative: Binding[];
  positive: Binding[];
}

/**
 * Named actions on top of raw device state.
 *
 * Game code asks for `"jump"` rather than `"Space"`, which keeps the game logic free of hardware
 * details and lets a keyboard, mouse and touch binding coexist for one action.
 */
export class InputMap {
  private readonly actions = new Map<string, Binding[]>();
  private readonly axes = new Map<string, AxisBinding>();
  private enabled = true;

  constructor(private readonly input: Input) {}

  /** Suspend action queries without detaching the underlying devices. */
  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    return this;
  }

  bindKey(action: string, code: string): this {
    return this.addBinding(action, { source: 'key', code });
  }

  bindMouse(action: string, button: number = 0): this {
    return this.addBinding(action, { source: 'mouse', code: button });
  }

  bindTouch(action: string): this {
    return this.addBinding(action, { source: 'touch', code: -1 });
  }

  private addBinding(action: string, binding: Binding): this {
    const existing = this.actions.get(action);
    if (existing) {
      if (!existing.some((b) => b.source === binding.source && b.code === binding.code)) existing.push(binding);
    } else {
      this.actions.set(action, [binding]);
    }
    return this;
  }

  /** Define an axis from two actions, e.g. `axis("moveX", "left", "right")`. */
  defineAxis(axis: string, negativeAction: string, positiveAction: string): this {
    this.axes.set(axis, {
      negative: this.actions.get(negativeAction) ?? [],
      positive: this.actions.get(positiveAction) ?? [],
    });
    return this;
  }

  clearBindings(): void {
    this.actions.clear();
    this.axes.clear();
  }

  get actionsBound(): string[] {
    return Array.from(this.actions.keys());
  }

  get axesBound(): string[] {
    return Array.from(this.axes.keys());
  }

  private bindingIsDown(binding: Binding): boolean {
    switch (binding.source) {
      case 'key':
        return this.input.keyboard.isDown(binding.code as string);
      case 'mouse':
        return this.input.mouse.isButtonDown(binding.code as number);
      case 'touch':
        return this.input.touch.isTouching;
    }
  }

  private bindingWasPressed(binding: Binding): boolean {
    switch (binding.source) {
      case 'key':
        return this.input.keyboard.wasPressed(binding.code as string);
      case 'mouse':
        return this.input.mouse.wasButtonPressed(binding.code as number);
      case 'touch':
        return this.input.touch.wasStarted();
    }
  }

  private bindingWasReleased(binding: Binding): boolean {
    switch (binding.source) {
      case 'key':
        return this.input.keyboard.wasReleased(binding.code as string);
      case 'mouse':
        return this.input.mouse.wasButtonReleased(binding.code as number);
      case 'touch':
        return this.input.touch.wasEnded();
    }
  }

  isDown(action: string): boolean {
    if (!this.enabled) return false;
    const bindings = this.actions.get(action);
    if (!bindings) return false;
    return bindings.some((binding) => this.bindingIsDown(binding));
  }

  wasPressed(action: string): boolean {
    if (!this.enabled) return false;
    const bindings = this.actions.get(action);
    if (!bindings) return false;
    return bindings.some((binding) => this.bindingWasPressed(binding));
  }

  wasReleased(action: string): boolean {
    if (!this.enabled) return false;
    const bindings = this.actions.get(action);
    if (!bindings) return false;
    return bindings.some((binding) => this.bindingWasReleased(binding));
  }

  /** -1, 0 or 1 from the axis' negative/positive actions. */
  getAxis(axis: string): number {
    if (!this.enabled) return 0;
    const definition = this.axes.get(axis);
    if (!definition) return 0;
    const isDown = (bindings: Binding[]) => bindings.some((binding) => this.bindingIsDown(binding));
    const negative = isDown(definition.negative) ? 1 : 0;
    const positive = isDown(definition.positive) ? 1 : 0;
    return positive - negative;
  }
}
