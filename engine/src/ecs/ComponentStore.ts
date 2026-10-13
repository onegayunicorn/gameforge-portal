import { componentHooks } from '../core/Component';
import type { Component, ComponentClass } from '../core/Component';
import type { EntityId } from '../core/Entity';

/**
 * Sparse-set style component storage: one `Map<EntityId, Component>` per component type.
 *
 * Lookups are O(1) and iteration is per-type, which keeps render and simulation loops tight
 * without the bookkeeping a full archetype system would require. Components are keyed by their
 * constructor, so a component type is identified by its class at runtime.
 */
export class ComponentStore {
  private readonly stores = new Map<ComponentClass, Map<EntityId, Component>>();

  private storeFor(type: ComponentClass, create: boolean): Map<EntityId, Component> | undefined {
    let store = this.stores.get(type);
    if (!store && create) {
      store = new Map();
      this.stores.set(type, store);
    }
    return store;
  }

  /**
   * Attach a component to an entity. Adding a second instance of the same type replaces the first
   * after calling its `onDetach` hook, which keeps "one component of a type per entity" true.
   */
  add<T extends Component>(entity: EntityId, component: T): T {
    const type = component.constructor as ComponentClass<T>;
    const store = this.storeFor(type, true)!;
    const previous = store.get(entity) as T | undefined;
    if (previous && previous !== component) componentHooks(previous).onDetach?.();
    store.set(entity, component);
    componentHooks(component).onAttach?.();
    return component;
  }

  get<T extends Component>(entity: EntityId, type: ComponentClass<T>): T | undefined {
    return this.storeFor(type, false)?.get(entity) as T | undefined;
  }

  has(entity: EntityId, type: ComponentClass): boolean {
    return this.storeFor(type, false)?.has(entity) ?? false;
  }

  remove(entity: EntityId, type: ComponentClass): boolean {
    const store = this.storeFor(type, false);
    const component = store?.get(entity);
    if (!store || !component) return false;
    componentHooks(component).onDetach?.();
    store.delete(entity);
    if (store.size === 0) this.stores.delete(type);
    return true;
  }

  /** Remove every component belonging to an entity; called when the entity is destroyed. */
  removeAll(entity: EntityId): number {
    let removed = 0;
    for (const [type, store] of this.stores) {
      const component = store.get(entity);
      if (!component) continue;
      componentHooks(component).onDetach?.();
      store.delete(entity);
      if (store.size === 0) this.stores.delete(type);
      removed += 1;
    }
    return removed;
  }

  /** All components of a type, keyed by entity. Used by queries and serialisation. */
  entries<T extends Component>(type: ComponentClass<T>): IterableIterator<[EntityId, T]> {
    const store = this.storeFor(type, false);
    return (store ? store.entries() : new Map<EntityId, T>().entries()) as IterableIterator<[EntityId, T]>;
  }

  /** Raw storage for a type, or undefined when no entity has one. */
  storageFor<T extends Component>(type: ComponentClass<T>): ReadonlyMap<EntityId, T> | undefined {
    return this.storeFor(type, false) as ReadonlyMap<EntityId, T> | undefined;
  }

  count(type: ComponentClass): number {
    return this.storeFor(type, false)?.size ?? 0;
  }

  /** Component types that currently have at least one instance. */
  registeredTypes(): ComponentClass[] {
    return Array.from(this.stores.keys());
  }

  clear(): void {
    for (const store of this.stores.values()) {
      for (const component of store.values()) componentHooks(component).onDetach?.();
    }
    this.stores.clear();
  }
}
