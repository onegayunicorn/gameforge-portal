import { EntityManager } from '../ecs/EntityManager';
import { ComponentStore } from '../ecs/ComponentStore';
import { Query } from '../ecs/Query';
import { EventBus } from './EventBus';
import { Entity } from './Entity';
import { Scene } from './Scene';
import { compareSystems } from './System';
import { RenderQueue } from '../renderer/RenderQueue';
import type { EngineEvents } from './EngineEvents';
import type { Component, ComponentClass } from './Component';
import type { EntityId } from './Entity';
import type { System } from './System';
import type { Renderer } from '../renderer/Renderer';
import type { Camera } from '../renderer/Camera';
import type { Input } from '../input/Input';
import type { AssetManager } from '../assets/AssetManager';
import type { Logger } from '../diagnostics/Logger';
import type { Platform } from '../platform/Platform';

/**
 * Resources the Engine publishes for systems to use. Declared with type-only imports so the World
 * stays free of runtime dependencies on the renderer, input and asset layers.
 */
export interface WorldServices {
  renderer?: Renderer | null;
  camera?: Camera | null;
  input?: Input | null;
  assets?: AssetManager | null;
  logger?: Logger | null;
  platform?: Platform | null;
  /** Set by the Engine; systems should treat this as opaque. */
  engine?: unknown;
}

export interface WorldOptions {
  events?: EventBus<EngineEvents>;
  onError?: (error: unknown, context: string) => void;
  /**
   * When switching the active scene, destroy the outgoing scene's entities (default) or leave them
   * in place. Leaving them is only sensible for overlay scenes; see docs/ENGINE_ARCHITECTURE.md.
   */
  destroyEntitiesOnSceneSwitch?: boolean;
}

/**
 * The simulation space: entities, components, systems, scenes and the event bus.
 *
 * The World deliberately knows nothing about rendering backends or platform APIs - it can be
 * constructed and stepped headlessly, which is what makes the engine testable without a browser.
 */
export class World {
  readonly entities = new EntityManager();
  readonly components = new ComponentStore();
  readonly events: EventBus<EngineEvents>;
  readonly renderQueue = new RenderQueue();
  readonly services: WorldServices = {};

  private readonly systems: System[] = [];
  private systemsCache: System[] | null = null;
  private readonly scenes = new Map<string, Scene>();
  private activeSceneValue: Scene | null = null;
  private readonly destroyEntitiesOnSceneSwitch: boolean;
  private readonly onError: (error: unknown, context: string) => void;
  private disposed = false;

  constructor(options: WorldOptions = {}) {
    this.events = options.events ?? new EventBus<EngineEvents>();
    this.destroyEntitiesOnSceneSwitch = options.destroyEntitiesOnSceneSwitch ?? true;
    this.onError = options.onError ?? ((error, context) => {
      // eslint-disable-next-line no-console
      console.error(`[gameforge] error in ${context}`, error);
    });

    // Components must be released before the id is recycled from the alive set.
    this.entities.onDestroy((id) => {
      this.components.removeAll(id);
      for (const scene of this.scenes.values()) scene.removeEntity(id);
      this.events.emit('entity:destroyed', { id });
    });
  }

  /* ------------------------------------------------------------------ entities */

  createEntity(): EntityId {
    const id = this.entities.create();
    this.activeSceneValue?.addEntity(id);
    this.events.emit('entity:created', { id });
    return id;
  }

  /** Convenience: create an entity and attach components in one call. */
  spawn(...components: Component[]): Entity {
    const id = this.createEntity();
    for (const component of components) this.components.add(id, component);
    return new Entity(this, id);
  }

  entity(id: EntityId): Entity {
    return new Entity(this, id);
  }

  destroyEntity(id: EntityId): boolean {
    return this.entities.destroy(id);
  }

  isAlive(id: EntityId): boolean {
    return this.entities.isAlive(id);
  }

  get entityCount(): number {
    return this.entities.count;
  }

  addComponent<T extends Component>(id: EntityId, component: T): T {
    if (!this.entities.isAlive(id)) {
      throw new Error(`Cannot add ${component.constructor.name} to dead entity ${id}`);
    }
    return this.components.add(id, component);
  }

  getComponent<T extends Component>(id: EntityId, type: ComponentClass<T>): T | undefined {
    return this.components.get(id, type);
  }

  hasComponent(id: EntityId, type: ComponentClass): boolean {
    return this.components.has(id, type);
  }

  removeComponent(id: EntityId, type: ComponentClass): boolean {
    return this.components.remove(id, type);
  }

  /** Build a query over the given component types; reusing a query is cheaper than rebuilding it. */
  query(...types: ComponentClass[]): Query {
    return new Query(this.components, types);
  }

  /* ------------------------------------------------------------------ systems */

  addSystem(system: System): this {
    if (this.systems.includes(system)) return this;
    this.systems.push(system);
    system.initialize?.(this);
    this.invalidateSystemOrder();
    return this;
  }

  removeSystem(system: System): boolean {
    const index = this.systems.indexOf(system);
    if (index === -1) return false;
    this.systems.splice(index, 1);
    system.dispose?.();
    this.invalidateSystemOrder();
    return true;
  }

  get systemList(): readonly System[] {
    return this.systems;
  }

  /** Force the merged system list to be rebuilt on the next update (scene switch, add/remove). */
  invalidateSystemOrder(): void {
    this.systemsCache = null;
  }

  private orderedSystems(): System[] {
    if (this.systemsCache) return this.systemsCache;
    const sceneSystems = this.activeSceneValue?.systems ?? [];
    const merged = sceneSystems.length === 0
      ? this.systems.slice()
      : [...this.systems, ...sceneSystems];
    merged.sort(compareSystems);
    this.systemsCache = merged;
    return merged;
  }

  /* ------------------------------------------------------------------ scenes */

  addScene(scene: Scene): Scene {
    if (this.scenes.has(scene.name) && this.scenes.get(scene.name) !== scene) {
      throw new Error(`A scene named "${scene.name}" already exists in this world`);
    }
    this.scenes.set(scene.name, scene);
    return scene;
  }

  getScene(name: string): Scene | undefined {
    return this.scenes.get(name);
  }

  get sceneNames(): string[] {
    return Array.from(this.scenes.keys());
  }

  /**
   * Activate a scene by reference or name. The outgoing scene's entities are destroyed by default,
   * so a level transition cannot leak entities from the previous level into the next one.
   */
  setActiveScene(scene: Scene | string | null): Scene | null {
    const next = typeof scene === 'string' ? this.scenes.get(scene) ?? null : scene;
    if (typeof scene === 'string' && !next) {
      throw new Error(`Cannot activate unknown scene "${scene}"`);
    }
    if (next === this.activeSceneValue) return this.activeSceneValue;

    const previousName = this.activeSceneValue?.name ?? null;

    if (this.activeSceneValue) {
      if (this.destroyEntitiesOnSceneSwitch) {
        for (const id of Array.from(this.activeSceneValue.entities)) this.entities.destroy(id);
      }
      this.activeSceneValue.detach();
    }

    this.activeSceneValue = next;
    if (next) {
      if (!this.scenes.has(next.name)) this.scenes.set(next.name, next);
      next.attach(this);
      this.events.emit('scene:changed', { from: previousName, to: next.name });
    }
    this.invalidateSystemOrder();
    return this.activeSceneValue;
  }

  get activeScene(): Scene | null {
    return this.activeSceneValue;
  }

  /* ------------------------------------------------------------------ stepping */

  /** Fixed-rate simulation step: runs every system in priority order. */
  update(deltaSeconds: number): void {
    if (this.disposed) return;
    for (const system of this.orderedSystems()) {
      if (!system.update) continue;
      try {
        system.update(this, deltaSeconds);
      } catch (error) {
        this.onError(error, `system ${system.name ?? 'anonymous'} update`);
      }
    }
  }

  /** Variable-rate presentation step. Systems that draw implement `render`. */
  render(alpha: number): void {
    if (this.disposed) return;
    for (const system of this.orderedSystems()) {
      if (!system.render) continue;
      try {
        system.render(this, alpha);
      } catch (error) {
        this.onError(error, `system ${system.name ?? 'anonymous'} render`);
      }
    }
  }

  /* ------------------------------------------------------------------ lifecycle */

  /** Destroy every entity and clear the render queue, keeping systems and scenes registered. */
  clear(): void {
    this.entities.destroyAll();
    this.renderQueue.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    for (const system of this.systems.slice()) this.removeSystem(system);
    for (const scene of this.scenes.values()) scene.dispose();
    this.scenes.clear();
    this.activeSceneValue = null;
    this.events.clear();
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
