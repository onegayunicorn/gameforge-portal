import type { Component, ComponentClass } from '../core/Component';
import type { EntityId } from '../core/Entity';
import type { World } from '../core/World';

/**
 * Base class for gameplay behaviour attached to an entity.
 *
 * Lifecycle methods are synchronous by design: a fixed simulation step must not depend on how long
 * a promise takes to settle. Anything asynchronous (loading a level, waiting for an animation)
 * should be started in `onStart` and observed in `onUpdate`.
 */
export abstract class Script implements Component {
  /** Typed as `string` so a subclass may narrow it to its own name without a static-side error. */
  static readonly componentName: string = 'Script';

  /** Set by ScriptSystem when the script is attached to a live entity. */
  entity: EntityId = -1;
  /** Set by ScriptSystem. Convenience for `world.entity(this.entity)`. */
  world: World | null = null;

  /** Disabled scripts keep their state but are skipped by ScriptSystem. */
  enabled = true;

  private started = false;
  private destroyed = false;

  get hasStarted(): boolean {
    return this.started;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Called once, before the first `onUpdate`. */
  onStart(): void {}

  /** Called every simulation step while `enabled` is true. */
  onUpdate(_deltaSeconds: number): void {}

  /** Called once when the entity or component is removed. */
  onDestroy(): void {}

  /**
   * Called when `enabled` flips. Useful for pausing timers without losing state, which
   * `onDestroy` cannot do.
   */
  onEnabledChanged(_enabled: boolean): void {}

  /** Shorthand for the component lookup most scripts perform. */
  getComponent<T extends Component>(type: ComponentClass<T>): T | undefined {
    return this.world && this.entity >= 0 ? this.world.getComponent(this.entity, type) : undefined;
  }

  /**
   * Component hook: fires when the component is removed or its entity is destroyed.
   *
   * This is the only reliable teardown point - by the time `entity:destroyed` is emitted the
   * component store has already dropped the component, so a listener could never find it.
   */
  onDetach(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.onDestroy();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[gameforge] error in script onDestroy', error);
    }
  }

  /* ---------------------------------------------------------------- internal */

  /** @internal - driven by ScriptSystem. */
  markStarted(): void {
    this.started = true;
  }

  /** @internal - driven by ScriptSystem. */
  markDestroyed(): void {
    this.destroyed = true;
  }
}
