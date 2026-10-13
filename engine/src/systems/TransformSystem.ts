import { Transform } from '../scene/Transform';
import { SystemPriority } from '../core/System';
import type { System } from '../core/System';
import type { World } from '../core/World';
import type { EntityId } from '../core/Entity';
import type { Profiler } from '../diagnostics/Profiler';

/**
 * Resolves local transforms into world transforms.
 *
 * Parents are composed before children (depth-first from the roots) and only dirty subtrees are
 * recomputed, so a static scene costs one pass at startup rather than one pass per frame.
 * A parent reference always wins over the child's own stored world values, which keeps the
 * derived data authoritative.
 */
export class TransformSystem implements System {
  readonly name = 'TransformSystem';
  readonly priority = SystemPriority.Transform;

  private profiler: Profiler | null = null;
  private readonly visited = new Set<EntityId>();

  initialize(world: World): void {
    this.profiler = (world.services as { profiler?: Profiler | null }).profiler ?? null;
  }

  update(world: World): void {
    this.profiler?.begin(this.name);
    try {
      const storage = world.components.storageFor(Transform);
      if (!storage || storage.size === 0) return;

      this.visited.clear();
      const roots: EntityId[] = [];

      for (const [id, transform] of storage) {
        const parentId = transform.parent;
        const parentHasTransform = parentId !== null && world.components.has(parentId, Transform);

        if (!parentHasTransform) {
          // A dangling parent reference degrades to "no parent" rather than throwing.
          transform.parent = null;
          roots.push(id);
          continue;
        }

        const parentTransform = world.components.get(parentId as number, Transform);
        if (parentTransform && !parentTransform.children.includes(id)) parentTransform.children.push(id);
      }

      for (const id of roots) this.computeWorld(world, id, null);

      // Children are reached from their roots; anything left is in a cycle and is treated as a root
      // so the transform still resolves to something usable instead of staying stale.
      for (const [id, transform] of storage) {
        if (this.visited.has(id)) continue;
        transform.parent = null;
        this.computeWorld(world, id, null);
      }
    } finally {
      this.profiler?.end(this.name);
    }
  }

  private computeWorld(world: World, id: EntityId, parent: Transform | null): void {
    if (this.visited.has(id)) return;
    this.visited.add(id);

    const transform = world.components.get(id, Transform);
    if (!transform) return;

    if (!parent) {
      transform.worldPosition.copy(transform.position);
      transform.worldRotation = transform.rotation;
      transform.worldScale.copy(transform.scale);
    } else {
      const cos = Math.cos(parent.worldRotation);
      const sin = Math.sin(parent.worldRotation);
      const scaledX = transform.position.x * parent.worldScale.x;
      const scaledY = transform.position.y * parent.worldScale.y;
      transform.worldPosition.set(
        parent.worldPosition.x + scaledX * cos - scaledY * sin,
        parent.worldPosition.y + scaledX * sin + scaledY * cos,
      );
      transform.worldRotation = parent.worldRotation + transform.rotation;
      transform.worldScale.set(
        parent.worldScale.x * transform.scale.x,
        parent.worldScale.y * transform.scale.y,
      );
    }

    transform.clearDirty();

    for (const childId of transform.children) {
      if (!world.components.has(childId, Transform)) continue;
      this.computeWorld(world, childId, transform);
    }
  }
}
