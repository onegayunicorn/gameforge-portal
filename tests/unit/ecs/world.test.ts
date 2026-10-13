import { describe, expect, it, vi } from 'vitest';
import {
  ComponentStore,
  EntityManager,
  Query,
  Scene,
  Transform,
  TransformSystem,
  Vector2,
  World,
} from '@gameforge/engine';
import { componentHooks } from '@gameforge/engine';
import type { Component } from '@gameforge/engine';

class Health implements Component {
  static readonly componentName = 'Health';
  constructor(public value: number = 100) {}
}

class Armour implements Component {
  static readonly componentName = 'Armour';
  constructor(public value: number = 10) {}
}

describe('EntityManager', () => {
  it('allocates unique monotonic ids and never reuses a destroyed one', () => {
    const manager = new EntityManager();
    const first = manager.create();
    const second = manager.create();
    expect(second).toBeGreaterThan(first);

    manager.destroy(first);
    const third = manager.create();
    expect(third).not.toBe(first);
    expect(manager.isAlive(first)).toBe(false);
    expect(manager.isAlive(third)).toBe(true);
    expect(manager.count).toBe(2);
  });

  it('notifies listeners exactly once per destruction', () => {
    const manager = new EntityManager();
    const listener = vi.fn();
    manager.onDestroy(listener);
    const id = manager.create();
    manager.destroy(id);
    manager.destroy(id);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(id);
  });

  it('resets ids for a reproducible test run', () => {
    const manager = new EntityManager();
    manager.create();
    manager.reset();
    expect(manager.create()).toBe(1);
  });
});

describe('ComponentStore', () => {
  it('keeps one component per type per entity and replaces cleanly', () => {
    const store = new ComponentStore();
    store.add(1, new Health(100));
    store.add(1, new Health(50));
    expect(store.get(1, Health)?.value).toBe(50);
    expect(store.count(Health)).toBe(1);
  });

  it('runs lifecycle hooks on attach, replace and removal', () => {
    const store = new ComponentStore();
    const detach = vi.fn();
    const attach = vi.fn();
    const decorated = new Health(1);
    componentHooks(decorated).onAttach = attach;
    componentHooks(decorated).onDetach = detach;

    store.add(1, decorated);
    expect(attach).toHaveBeenCalledTimes(1);

    store.add(1, new Health(2));
    expect(detach).toHaveBeenCalledTimes(1);

    expect(store.remove(1, Health)).toBe(true);
    expect(store.count(Health)).toBe(0);
  });

  it('drops every component of an entity on removeAll and clears empty storages', () => {
    const store = new ComponentStore();
    store.add(1, new Health());
    store.add(1, new Armour());
    store.add(2, new Health());
    expect(store.removeAll(1)).toBe(2);
    expect(store.registeredTypes()).toContain(Health);
    expect(store.count(Health)).toBe(1);
  });
});

describe('Query', () => {
  it('matches only entities holding every queried component', () => {
    const store = new ComponentStore();
    store.add(1, new Health());
    store.add(1, new Armour());
    store.add(2, new Health());
    store.add(3, new Armour());

    const both = new Query(store, [Health, Armour]);
    expect(both.count).toBe(1);
    expect(both.first()?.entity).toBe(1);
    expect(both.matches(1)).toBe(true);
    expect(both.matches(2)).toBe(false);
  });

  it('is empty (and cheap) when a queried type has no instances', () => {
    const store = new ComponentStore();
    store.add(1, new Health());
    const query = new Query(store, [Health, Armour]);
    expect(query.count).toBe(0);
    expect(query.first()).toBeNull();
  });
});

describe('World', () => {
  it('releases components when an entity is destroyed', () => {
    const world = new World();
    const entity = world.spawn(new Health());
    expect(world.getComponent(entity.id, Health)).toBeDefined();
    world.destroyEntity(entity.id);
    expect(world.isAlive(entity.id)).toBe(false);
    expect(world.getComponent(entity.id, Health)).toBeUndefined();
  });

  it('refuses to attach components to a dead entity', () => {
    const world = new World();
    const id = world.createEntity();
    world.destroyEntity(id);
    expect(() => world.addComponent(id, new Health())).toThrow(/dead entity/i);
  });

  it('runs systems in ascending priority order', () => {
    const world = new World();
    const order: string[] = [];
    world.addSystem({ name: 'late', priority: 100, update: () => void order.push('late') });
    world.addSystem({ name: 'early', priority: -100, update: () => void order.push('early') });
    world.addSystem({ name: 'mid', priority: 0, update: () => void order.push('mid') });
    world.update(1 / 60);
    expect(order).toEqual(['early', 'mid', 'late']);
  });

  it('isolates a throwing system so the rest of the frame still runs', () => {
    const errors: unknown[] = [];
    const world = new World({ onError: (error) => void errors.push(error) });
    const survivor = vi.fn();
    world.addSystem({ name: 'broken', priority: 0, update: () => { throw new Error('boom'); } });
    world.addSystem({ name: 'survivor', priority: 1, update: survivor });
    expect(() => world.update(1 / 60)).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
  });

  it('destroys the outgoing scene entities on a scene switch, and emits an event', () => {
    const world = new World();
    const changed: string[] = [];
    world.events.on('scene:changed', ({ to }) => void changed.push(to));

    const first = world.addScene(new Scene('first'));
    world.setActiveScene(first);
    world.spawn(new Health());
    expect(world.entityCount).toBe(1);

    const second = world.addScene(new Scene('second'));
    world.setActiveScene(second);
    expect(world.entityCount).toBe(0);
    expect(world.activeScene?.name).toBe('second');
    // Two events: null -> first, then first -> second. The first activation counts too.
    expect(changed).toEqual(['first', 'second']);
  });

  it('rejects duplicate scene names and unknown activation', () => {
    const world = new World();
    world.addScene(new Scene('level'));
    expect(() => world.addScene(new Scene('level'))).toThrow(/already exists/i);
    expect(() => world.setActiveScene('missing')).toThrow(/unknown scene/i);
  });
});

describe('TransformSystem', () => {
  it('composes parent transforms into world space', () => {
    const world = new World();
    world.addSystem(new TransformSystem());

    const parent = world.spawn(new Transform(new Vector2(100, 50)));
    const parentTransform = parent.get(Transform)!;
    parentTransform.setRotationDegrees(90);

    const child = world.spawn(new Transform(new Vector2(10, 0)));
    child.get(Transform)!.parent = parent.id;

    world.update(1 / 60);

    const childTransform = child.get(Transform)!;
    // A child 10 units along the parent's local +X, with the parent rotated 90 degrees, lands
    // 10 units along world +Y from the parent origin.
    expect(childTransform.worldPosition.x).toBeCloseTo(100, 5);
    expect(childTransform.worldPosition.y).toBeCloseTo(60, 5);
    expect(childTransform.worldRotation).toBeCloseTo(Math.PI / 2, 5);
  });

  it('scales a child position by the parent scale', () => {
    const world = new World();
    world.addSystem(new TransformSystem());
    const parent = world.spawn(new Transform(new Vector2(0, 0)));
    parent.get(Transform)!.setScale(2, 2);
    const child = world.spawn(new Transform(new Vector2(10, 10)));
    child.get(Transform)!.parent = parent.id;
    world.update(1 / 60);
    expect(child.get(Transform)!.worldPosition.x).toBeCloseTo(20, 5);
  });

  it('degrades a dangling parent reference to a root instead of throwing', () => {
    const world = new World();
    world.addSystem(new TransformSystem());
    const orphan = world.spawn(new Transform(new Vector2(5, 5)));
    const transform = orphan.get(Transform)!;
    transform.parent = 9999;
    expect(() => world.update(1 / 60)).not.toThrow();
    expect(transform.parent).toBeNull();
    expect(transform.worldPosition.x).toBe(5);
  });
});
