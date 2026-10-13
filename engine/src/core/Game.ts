import type { Engine } from './Engine';

/**
 * A game is the entry module's exported shape: everything else (scenes, entities, systems) is
 * built by `setup`. Keeping this contract tiny is deliberate - the runtime, the builder and the
 * editor all need to recognise a game module, and a two-method contract is easy to satisfy.
 */
export interface Game {
  /** Shown in the runtime and the portal. Defaults to the project id. */
  readonly name?: string;
  /** Build the initial scene(s). Awaited before the loop starts. */
  setup(engine: Engine): void | Promise<void>;
  /** Release resources. Optional; the engine disposes what it created itself. */
  teardown?(engine: Engine): void | Promise<void>;
}

export function isGame(value: unknown): value is Game {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Game).setup === 'function';
}

/** Convenience base class for games that prefer `extends` over an object literal. */
export abstract class GameBase implements Game {
  readonly name?: string;

  constructor(name?: string) {
    if (name !== undefined) this.name = name;
  }

  abstract setup(engine: Engine): void | Promise<void>;

  teardown(_engine: Engine): void | Promise<void> {
    // Optional for subclasses.
  }
}
