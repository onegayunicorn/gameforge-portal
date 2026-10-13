import { Script } from '../scripting/Script';
import { SystemPriority } from '../core/System';
import { invokeOnDestroy, invokeOnStart, invokeOnUpdate } from '../scripting/Lifecycle';
import type { LifecycleOptions } from '../scripting/Lifecycle';
import type { System } from '../core/System';
import type { World } from '../core/World';
import type { EntityId } from '../core/Entity';
import type { ComponentClass } from '../core/Component';
import type { Profiler } from '../diagnostics/Profiler';

/**
 * True when `type` is `Script` or one of its subclasses.
 *
 * The component store keys components by their concrete constructor, so `storageFor(Script)` finds
 * nothing for a subclass. ScriptSystem therefore discovers the concrete script classes once and
 * iterates those - this is the polymorphism the store deliberately does not provide.
 */
export function isScriptClass(type: ComponentClass): boolean {
  if (type === (Script as unknown as ComponentClass)) return true;
  const prototype = (type as unknown as { prototype?: object }).prototype;
  return typeof prototype === 'object' && prototype !== null && Script.prototype.isPrototypeOf(prototype);
}

export interface ScriptSystemOptions extends LifecycleOptions {
  /** Log how many scripts ran each frame. Noisy; development only. */
  verbose?: boolean;
}

/**
 * Drives script lifecycle.
 *
 * A script starts on the step after it is attached (rather than immediately) so `onStart` always
 * sees a fully built entity - the common source of "my sibling component is missing" bugs.
 * Destroyed scripts get their `onDestroy` exactly once, even if the entity was destroyed mid-frame.
 */
export class ScriptSystem implements System {
  readonly name = 'ScriptSystem';
  readonly priority = SystemPriority.Script;

  private readonly options: ScriptSystemOptions;
  private profiler: Profiler | null = null;
  private startedCount = 0;
  private updatedCount = 0;
  private initialized = false;
  private readonly pendingDestroy = new Set<Script>();
  /** Concrete script classes seen so far, rebuilt only when the set of component types grows. */
  private readonly scriptTypes = new Set<ComponentClass>();
  private knownTypeCount = -1;

  constructor(options: ScriptSystemOptions = {}) {
    this.options = options;
  }

  initialize(world: World): void {
    this.profiler = (world.services as { profiler?: Profiler | null }).profiler ?? null;
    if (this.initialized) return;
    this.initialized = true;
    // Teardown is handled by Script.onDetach, which fires before the component is dropped. This
    // system owns no listener so it cannot run teardown twice for the same script.
  }

  /** Every live script component, gathered across the concrete script classes in use. */
  private collectScripts(world: World): [EntityId, Script][] {
    const types = world.components.registeredTypes();
    if (types.length !== this.knownTypeCount) {
      this.knownTypeCount = types.length;
      this.scriptTypes.clear();
      for (const type of types) {
        if (isScriptClass(type)) this.scriptTypes.add(type);
      }
    }

    const entries: [EntityId, Script][] = [];
    for (const type of this.scriptTypes) {
      const storage = world.components.storageFor(type);
      if (!storage) continue;
      for (const [entityId, component] of storage) entries.push([entityId, component as Script]);
    }
    // Stable order so script execution is reproducible (component maps preserve insertion order,
    // but multiple script classes would otherwise interleave by registration order).
    entries.sort((a, b) => a[0] - b[0]);
    return entries;
  }

  update(world: World, deltaSeconds: number): void {
    this.profiler?.begin(this.name);
    this.startedCount = 0;
    this.updatedCount = 0;
    try {
      // Iterate a snapshot: scripts commonly spawn or destroy entities while running.
      const entries = this.collectScripts(world);
      if (entries.length === 0) return;

      for (const [entityId, script] of entries) {
        if (script.isDestroyed) continue;

        // Entities removed since the last step are cleaned up before anything else runs.
        if (!world.isAlive(entityId)) {
          this.destroyScript(script);
          continue;
        }

        if (script.entity !== entityId) {
          script.entity = entityId;
          script.world = world;
        }

        if (!script.hasStarted) {
          if (invokeOnStart(script, this.options)) this.startedCount += 1;
          if (script.isDestroyed) continue;
        }

        if (!script.enabled) continue;

        if (invokeOnUpdate(script, deltaSeconds, this.options)) this.updatedCount += 1;
      }
    } finally {
      this.profiler?.end(this.name);
    }
  }

  /** Force a script's teardown, e.g. when a system is removed at runtime. */
  destroyScript(script: Script): void {
    if (script.isDestroyed) return;
    this.pendingDestroy.delete(script);
    invokeOnDestroy(script, this.options);
  }

  get lastFrameStats(): { started: number; updated: number } {
    return { started: this.startedCount, updated: this.updatedCount };
  }

  dispose(): void {
    this.profiler = null;
  }
}
