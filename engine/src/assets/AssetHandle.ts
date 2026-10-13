import type { AssetType } from './AssetManifest';

export type AssetState = 'pending' | 'loading' | 'ready' | 'failed';

/**
 * A request for one asset.
 *
 * Handles are the currency of the asset system: they are returned synchronously (so call sites can
 * store them during scene setup) and resolve later. The same handle is shared by every caller
 * requesting the same id, which is what de-duplicates concurrent loads.
 */
export class AssetHandle<T = unknown> {
  readonly id: string;
  readonly type: AssetType;
  readonly source: string;

  private stateValue: AssetState = 'pending';
  private valueValue: T | undefined;
  private errorValue: Error | null = null;
  private resolveFn!: (value: T) => void;
  private rejectFn!: (error: Error) => void;

  /** Resolves with the asset, or rejects with the load error. */
  readonly promise: Promise<T>;

  constructor(id: string, type: AssetType, source: string) {
    this.id = id;
    this.type = type;
    this.source = source;
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
    // Nothing may attach a rejection handler before the caller awaits the handle, and an
    // unhandled rejection would crash the page; the rejection is re-thrown on await instead.
    this.promise.catch(() => undefined);
  }

  get state(): AssetState {
    return this.stateValue;
  }

  get isPending(): boolean {
    return this.stateValue === 'pending';
  }

  get isLoading(): boolean {
    return this.stateValue === 'loading' || this.stateValue === 'pending';
  }

  get isReady(): boolean {
    return this.stateValue === 'ready';
  }

  get isFailed(): boolean {
    return this.stateValue === 'failed';
  }

  /** The loaded asset. Throws when it is not ready, so misuse surfaces immediately. */
  get value(): T {
    if (this.stateValue !== 'ready') {
      throw new Error(`Asset "${this.id}" is ${this.stateValue}, not ready`);
    }
    return this.valueValue as T;
  }

  /** The loaded asset, or undefined when it is not ready yet. */
  get maybeValue(): T | undefined {
    return this.stateValue === 'ready' ? this.valueValue : undefined;
  }

  get error(): Error | null {
    return this.errorValue;
  }

  /** @internal - called by AssetManager. */
  markLoading(): void {
    if (this.stateValue === 'pending') this.stateValue = 'loading';
  }

  /** @internal - called by AssetManager. */
  markReady(value: T): void {
    this.stateValue = 'ready';
    this.valueValue = value;
    this.resolveFn(value);
  }

  /** @internal - called by AssetManager. */
  markFailed(error: Error): void {
    this.stateValue = 'failed';
    this.errorValue = error;
    this.rejectFn(error);
  }

  /** @internal - reset for a reload (development hot reload). */
  reset(): void {
    this.stateValue = 'pending';
    this.valueValue = undefined;
    this.errorValue = null;
  }

  toString(): string {
    return `AssetHandle(${this.id} [${this.type}] ${this.stateValue})`;
  }
}
