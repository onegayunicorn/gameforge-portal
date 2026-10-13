import type { EntityId } from '../core/Entity';

/**
 * Allocates and recycles entity ids.
 *
 * Ids are monotonically increasing and reset only via `reset()`, which is what makes a
 * deterministic test run reproducible: the same construction order yields the same ids.
 * Ids are never reused within a run, so a stale reference always fails `isAlive` rather than
 * silently addressing a different entity.
 */
export class EntityManager {
  private nextId = 1;
  private readonly alive = new Set<EntityId>();
  private readonly destroyListeners = new Set<(id: EntityId) => void>();

  create(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  createMany(count: number): EntityId[] {
    const ids: EntityId[] = new Array(count);
    for (let i = 0; i < count; i += 1) ids[i] = this.create();
    return ids;
  }

  /** Destroy an entity. Returns false when it was already gone. */
  destroy(id: EntityId): boolean {
    if (!this.alive.delete(id)) return false;
    for (const listener of Array.from(this.destroyListeners)) listener(id);
    return true;
  }

  destroyAll(): void {
    for (const id of Array.from(this.alive)) this.destroy(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  ids(): IterableIterator<EntityId> {
    return this.alive.values();
  }

  get count(): number {
    return this.alive.size;
  }

  /** Subscribe to destruction so component storage can detach cleanly. */
  onDestroy(listener: (id: EntityId) => void): () => void {
    this.destroyListeners.add(listener);
    return () => this.destroyListeners.delete(listener);
  }

  /** Return to a pristine state. Intended for tests and full scene reloads. */
  reset(): void {
    this.alive.clear();
    this.nextId = 1;
  }
}
