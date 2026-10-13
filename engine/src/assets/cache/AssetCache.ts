/**
 * Loaded assets keyed by id, with simple reference counting.
 *
 * The cache never evicts an asset that something still holds (`release` must be called as many
 * times as `retain`). Once the reference count reaches zero the entry becomes evictable, and
 * `prune()` removes unreferenced entries - which is what makes scene transitions release the
 * previous level's textures instead of leaking them until the tab is closed.
 */
export class AssetCache<T = unknown> {
  private readonly entries = new Map<string, T>();
  private readonly refCounts = new Map<string, number>();
  private readonly capacity: number;

  constructor(capacity: number = Number.POSITIVE_INFINITY) {
    this.capacity = Math.max(1, capacity);
  }

  get size(): number {
    return this.entries.size;
  }

  get keys(): string[] {
    return Array.from(this.entries.keys());
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): T | undefined {
    return this.entries.get(id);
  }

  /** Store an asset and mark it as referenced once. */
  set(id: string, value: T): void {
    this.entries.set(id, value);
    this.refCounts.set(id, (this.refCounts.get(id) ?? 0) + 1);
  }

  /** Increase the reference count for an existing entry. */
  retain(id: string): boolean {
    if (!this.entries.has(id)) return false;
    this.refCounts.set(id, (this.refCounts.get(id) ?? 0) + 1);
    return true;
  }

  /** Decrease the reference count. The entry stays until `prune()` runs. */
  release(id: string): boolean {
    const count = this.refCounts.get(id);
    if (count === undefined) return false;
    if (count <= 1) this.refCounts.set(id, 0);
    else this.refCounts.set(id, count - 1);
    return true;
  }

  referenceCount(id: string): number {
    return this.refCounts.get(id) ?? 0;
  }

  /** Drop every unreferenced entry. Returns the ids that were evicted. */
  prune(): string[] {
    const evicted: string[] = [];
    for (const id of Array.from(this.entries.keys())) {
      if ((this.refCounts.get(id) ?? 0) <= 0) {
        this.entries.delete(id);
        this.refCounts.delete(id);
        evicted.push(id);
      }
    }
    return evicted;
  }

  delete(id: string): boolean {
    this.refCounts.delete(id);
    return this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
    this.refCounts.clear();
  }

  /** True when the cache is at capacity; the manager uses this to prune after a load batch. */
  get isFull(): boolean {
    return this.entries.size >= this.capacity;
  }
}
