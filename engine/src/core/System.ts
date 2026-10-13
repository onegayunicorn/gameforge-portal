import type { World } from './World';

/**
 * Systems hold all behaviour. They run in ascending `priority` order (lower runs first) so that
 * input resolves before simulation, and simulation before rendering, without hard-coding an order
 * into the engine.
 */
export interface System {
  /** Human-readable name used in diagnostics and profiler output. */
  readonly name?: string;

  /** Lower values run first. Defaults to 0. */
  priority?: number;

  /** Called once when the system is added to a world that is already running. */
  initialize?(world: World): void;

  /** Fixed-rate simulation step. `deltaSeconds` is the engine's fixed time step. */
  update?(world: World, deltaSeconds: number): void;

  /** Variable-rate presentation step, called once per rendered frame. */
  render?(world: World, alpha: number): void;

  /** Release any resources the system owns. */
  dispose?(): void;
}

/** Priority bands for the built-in systems; custom systems may use anything between. */
export const SystemPriority = {
  Input: -500,
  Transform: -300,
  Script: -100,
  Physics: 0,
  Animation: 100,
  Render: 500,
  Ui: 600,
  DebugDraw: 900,
} as const;

export function compareSystems(a: System, b: System): number {
  return (a.priority ?? 0) - (b.priority ?? 0);
}
