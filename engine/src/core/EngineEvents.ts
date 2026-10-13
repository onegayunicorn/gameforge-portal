import type { EntityId } from './Entity';
import type { RendererBackend } from './EngineConfig';

/**
 * The engine's internal event catalogue. Games may extend it by passing their own event map to
 * `world.events`, but these names are reserved so tooling (the portal's runtime console, the
 * profiler and the editor) can subscribe to a known vocabulary.
 */
export interface EngineEvents extends Record<string, unknown> {
  'engine:ready': { backend: RendererBackend; width: number; height: number };
  'engine:started': { startedAt: number };
  'engine:stopped': { frames: number; elapsed: number };
  'engine:paused': { elapsed: number };
  'engine:resumed': { elapsed: number };
  'engine:resized': { width: number; height: number; pixelRatio: number };
  'engine:error': { error: Error; phase: string };

  'scene:changed': { from: string | null; to: string };
  'entity:created': { id: EntityId };
  'entity:destroyed': { id: EntityId };

  'asset:started': { count: number };
  'asset:progress': { loaded: number; total: number; id: string };
  'asset:failed': { id: string; error: Error };
  'asset:complete': { count: number; elapsedMs: number };
}
