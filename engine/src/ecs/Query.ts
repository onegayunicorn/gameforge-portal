import type { Component, ComponentClass } from '../core/Component';
import type { EntityId } from '../core/Entity';
import type { ComponentStore } from './ComponentStore';

/** One match of a query: the entity id plus its components in the order the query declared them. */
export interface QueryMatch<T extends readonly Component[] = readonly Component[]> {
  entity: EntityId;
  components: T;
}

/**
 * A reusable "entities that have all of these components" view.
 *
 * The smallest component store drives iteration and the remaining types are checked with O(1)
 * lookups, so query cost tracks the rarest component rather than the entity count.
 */
export class Query<T extends readonly Component[] = readonly Component[]> {
  private readonly types: readonly ComponentClass[];
  private readonly driver: ComponentClass | null;

  constructor(private readonly store: ComponentStore, types: readonly ComponentClass[]) {
    this.types = types.slice();
    let smallest: ComponentClass | null = null;
    let smallestSize = Number.POSITIVE_INFINITY;
    for (const type of this.types) {
      const size = store.count(type);
      if (size < smallestSize) {
        smallestSize = size;
        smallest = type;
      }
    }
    // An empty store means the query can never match; skipping the driver keeps it O(1).
    this.driver = smallestSize === 0 ? null : smallest;
  }

  get componentTypes(): readonly ComponentClass[] {
    return this.types;
  }

  /** Number of entities currently matching. */
  get count(): number {
    if (!this.driver) return 0;
    let total = 0;
    for (const _ of this) total += 1;
    return total;
  }

  /** True when the entity carries every queried component type. */
  matches(entity: EntityId): boolean {
    for (const type of this.types) {
      if (!this.store.has(entity, type)) return false;
    }
    return true;
  }

  *[Symbol.iterator](): Generator<QueryMatch<T>> {
    if (!this.driver) return;
    const storage = this.store.storageFor(this.driver);
    if (!storage) return;

    for (const entity of storage.keys()) {
      const components: Component[] = new Array(this.types.length);
      let complete = true;
      for (let i = 0; i < this.types.length; i += 1) {
        const component = this.store.get(entity, this.types[i]);
        if (!component) {
          complete = false;
          break;
        }
        components[i] = component;
      }
      if (complete) yield { entity, components: components as unknown as T };
    }
  }

  /** Collect matches into an array without allocating a generator per call site. */
  toArray(): QueryMatch<T>[] {
    return Array.from(this);
  }

  forEach(callback: (match: QueryMatch<T>) => void): void {
    for (const match of this) callback(match);
  }

  first(): QueryMatch<T> | null {
    for (const match of this) return match;
    return null;
  }
}
