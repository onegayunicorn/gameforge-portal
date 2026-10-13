import type { Component, ComponentClass } from './Component';
import type { World } from './World';

/** Entity identifiers are plain integers, reused only after the world is reset. */
export type EntityId = number;

/**
 * A lightweight handle over an entity id.
 *
 * Handle objects are short-lived conveniences: the id is the identity, so a handle is only valid
 * while `world.isAlive(id)` holds. Systems that store long-lived references should store the id.
 */
export class Entity {
  constructor(private readonly world: World, readonly id: EntityId) {}

  get isAlive(): boolean {
    return this.world.isAlive(this.id);
  }

  add<T extends Component>(component: T): this {
    this.world.addComponent(this.id, component);
    return this;
  }

  get<T extends Component>(type: ComponentClass<T>): T | undefined {
    return this.world.getComponent(this.id, type);
  }

  has(type: ComponentClass<Component>): boolean {
    return this.world.hasComponent(this.id, type);
  }

  /** Get the component or throw - for required components in system code. */
  require<T extends Component>(type: ComponentClass<T>): T {
    const found = this.get(type);
    if (!found) {
      throw new Error(`Entity ${this.id} is missing required component ${type.name}`);
    }
    return found;
  }

  remove(type: ComponentClass<Component>): this {
    this.world.removeComponent(this.id, type);
    return this;
  }

  destroy(): void {
    this.world.destroyEntity(this.id);
  }

  toString(): string {
    return `Entity(${this.id})`;
  }
}
