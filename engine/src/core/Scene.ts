import type { System } from './System';
import type { EntityId } from './Entity';
import type { World } from './World';

/**
 * A named group of entities with its own systems and metadata.
 *
 * Scenes are the unit of level structure: a scene owns the entities created while it is active,
 * plus any systems that only matter for it. Serialisation (milestone 3) reads a scene back out
 * through `toJSON` and rebuilds it with `SceneLoader`.
 *
 * Only one scene is active at a time. Switching scenes tears down the previous scene's entities
 * (see `World.setActiveScene`), which keeps the query space global and simple - important because
 * queries back every system.
 */
export class Scene {
  readonly name: string;
  readonly systems: System[] = [];
  /** Free-form scene data - spawn points, music track, level index, and so on. */
  readonly metadata: Record<string, unknown> = {};
  /** The scene file this scene was loaded from, when it came from disk. */
  sourcePath: string | null = null;

  private readonly entityIds = new Set<EntityId>();
  private world: World | null = null;

  constructor(name: string, metadata?: Record<string, unknown>) {
    if (!name) throw new Error('Scene requires a non-empty name');
    this.name = name;
    if (metadata) Object.assign(this.metadata, metadata);
  }

  get isAttached(): boolean {
    return this.world !== null;
  }

  get worldRef(): World | null {
    return this.world;
  }

  get entityCount(): number {
    return this.entityIds.size;
  }

  get entities(): IterableIterator<EntityId> {
    return this.entityIds.values();
  }

  hasEntity(id: EntityId): boolean {
    return this.entityIds.has(id);
  }

  /** Register an entity with this scene. Called by World; not part of the game-facing API. */
  addEntity(id: EntityId): void {
    this.entityIds.add(id);
  }

  removeEntity(id: EntityId): boolean {
    return this.entityIds.delete(id);
  }

  clearEntities(): void {
    this.entityIds.clear();
  }

  addSystem(system: System): this {
    this.systems.push(system);
    if (this.world) system.initialize?.(this.world);
    this.world?.invalidateSystemOrder();
    return this;
  }

  removeSystem(system: System): boolean {
    const index = this.systems.indexOf(system);
    if (index === -1) return false;
    this.systems.splice(index, 1);
    system.dispose?.();
    this.world?.invalidateSystemOrder();
    return true;
  }

  /** Called by World when this scene becomes (or stops being) the active scene. */
  attach(world: World): void {
    if (this.world && this.world !== world) {
      throw new Error(`Scene "${this.name}" is already attached to a different world`);
    }
    this.world = world;
    for (const system of this.systems) system.initialize?.(world);
  }

  detach(): void {
    this.world = null;
  }

  dispose(): void {
    for (const system of this.systems) system.dispose?.();
    this.systems.length = 0;
    this.entityIds.clear();
    this.world = null;
  }

  toJSON(): { name: string; metadata: Record<string, unknown>; entityCount: number; systems: string[] } {
    return {
      name: this.name,
      metadata: { ...this.metadata },
      entityCount: this.entityIds.size,
      systems: this.systems.map((system) => system.name ?? 'anonymous'),
    };
  }

  toString(): string {
    return `Scene(${this.name}, entities=${this.entityIds.size})`;
  }
}
