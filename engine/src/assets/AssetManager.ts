import { AssetCache } from './cache/AssetCache';
import { AssetHandle } from './AssetHandle';
import { parseAssetManifest, createAssetManifest, findManifestEntry } from './AssetManifest';
import { JsonLoader } from './loaders/JsonLoader';
import { TextLoader } from './loaders/TextLoader';
import { TextureLoader } from './loaders/TextureLoader';
import type { AssetManifest, AssetManifestEntry, AssetType } from './AssetManifest';
import type { EventBus } from '../core/EventBus';
import type { EngineEvents } from '../core/EngineEvents';
import type { Logger } from '../diagnostics/Logger';

export interface AssetLoader<T = unknown> {
  readonly type: AssetType;
  load(source: string, entry: AssetManifestEntry): Promise<T>;
}

export interface AssetManagerOptions {
  /** Prefix for every relative source. Defaults to the document's directory ('.'). */
  basePath?: string;
  events?: EventBus<EngineEvents>;
  logger?: Logger | null;
  /** Injectable fetch, so tests and the headless runtime can stub asset responses. */
  fetchImpl?: typeof fetch;
  loaders?: AssetLoader[];
  cacheCapacity?: number;
}

export interface AssetProgress {
  loaded: number;
  total: number;
  ratio: number;
  currentId: string | null;
}

export interface PreloadReport {
  total: number;
  loaded: number;
  failed: { id: string; error: string }[];
  elapsedMs: number;
}

/**
 * Loads, de-duplicates and caches game assets.
 *
 * Every request goes through a handle, so asking for the same texture from ten entities performs
 * one network request. Failures are surfaced per asset (and emitted on the event bus) rather than
 * aborting the whole batch: one broken texture should not stop a game from starting.
 */
export class AssetManager {
  private readonly loaders = new Map<AssetType, AssetLoader>();
  private readonly handles = new Map<string, AssetHandle>();
  private readonly cache: AssetCache;
  private readonly events: EventBus<EngineEvents> | null;
  private readonly logger: Logger | null;
  private manifestValue: AssetManifest | null = null;
  private basePathValue: string;
  private loadedCount = 0;
  private failedCount = 0;
  private currentId: string | null = null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AssetManagerOptions = {}) {
    this.basePathValue = options.basePath ?? '';
    this.events = options.events ?? null;
    this.logger = options.logger ?? null;
    this.cache = new AssetCache(options.cacheCapacity);
    // Native fetch must be called with the global as its receiver: an unbound reference throws
    // "Illegal invocation". Bind whatever we are given so callers can pass `fetch` directly.
    if (options.fetchImpl) this.fetchImpl = options.fetchImpl.bind(globalThis) as typeof fetch;
    else if (typeof globalThis.fetch === 'function') this.fetchImpl = globalThis.fetch.bind(globalThis);
    else this.fetchImpl = (() => Promise.reject(new Error('No fetch implementation available'))) as unknown as typeof fetch;

    // Sensible defaults; a game may register additional loaders (audio arrives in milestone 4).
    const defaults: AssetLoader[] = [
      new TextureLoader(),
      new JsonLoader(this.fetchImpl),
      new TextLoader(this.fetchImpl),
    ];
    for (const loader of [...defaults, ...(options.loaders ?? [])]) this.registerLoader(loader);
  }

  registerLoader<T>(loader: AssetLoader<T>): this {
    this.loaders.set(loader.type, loader as AssetLoader);
    return this;
  }

  /* ------------------------------------------------------------------ manifest */

  /** Attach a manifest object, or fetch and validate one from a URL. */
  async loadManifest(source: string | AssetManifest): Promise<AssetManifest> {
    if (typeof source === 'string') {
      const response = await this.fetchImpl(source, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load asset manifest ${source}: HTTP ${response.status}`);
      }
      const manifest = parseAssetManifest(await response.json());
      if (!manifest.basePath && !this.basePathValue) {
        // Default relative sources against the manifest's own directory.
        const index = source.lastIndexOf('/');
        this.basePathValue = index >= 0 ? source.slice(0, index + 1) : '';
      }
      this.manifestValue = manifest;
      this.logger?.debug('asset manifest loaded', { assets: manifest.assets.length, basePath: this.basePathValue });
      return manifest;
    }

    this.manifestValue = parseAssetManifest(source);
    return this.manifestValue;
  }

  get manifest(): AssetManifest | null {
    return this.manifestValue;
  }

  get basePath(): string {
    return this.basePathValue;
  }

  setBasePath(basePath: string): void {
    this.basePathValue = basePath;
  }

  private resolveSource(entry: { source: string }): string {
    if (/^[a-z]+:\/\//i.test(entry.source) || entry.source.startsWith('/')) return entry.source;
    const base = this.basePathValue;
    if (!base) return entry.source;
    return base.endsWith('/') ? `${base}${entry.source}` : `${base}/${entry.source}`;
  }

  /* ------------------------------------------------------------------ requesting */

  /**
   * Request an asset by id. Returns a handle immediately; the same handle is returned for repeat
   * requests, which is what de-duplicates concurrent loads.
   */
  request<T = unknown>(id: string): AssetHandle<T> {
    const existing = this.handles.get(id);
    if (existing) return existing as AssetHandle<T>;

    const entry = this.manifestValue ? findManifestEntry(this.manifestValue, id) : undefined;
    if (!entry) {
      // Unknown ids still produce a handle so callers can await a well-typed failure.
      const missing = new AssetHandle<T>(id, 'json', id);
      missing.markFailed(new Error(`Asset "${id}" is not declared in the manifest`));
      return missing;
    }

    const handle = new AssetHandle<T>(id, entry.type, this.resolveSource(entry));
    this.handles.set(id, handle as AssetHandle);
    void this.startLoad(handle as AssetHandle, entry);
    return handle;
  }

  /** Await an asset, rejecting on failure. */
  async load<T = unknown>(id: string): Promise<T> {
    return this.request<T>(id).promise;
  }

  /** Await an asset, resolving to null on failure - handy for optional assets. */
  async tryLoad<T = unknown>(id: string): Promise<T | null> {
    try {
      return await this.request<T>(id).promise;
    } catch {
      return null;
    }
  }

  private async startLoad(handle: AssetHandle, entry: AssetManifestEntry): Promise<void> {
    const loader = this.loaders.get(entry.type);
    if (!loader) {
      const error = new Error(`No loader registered for asset type "${entry.type}" (asset "${entry.id}")`);
      this.fail(handle, error);
      return;
    }

    handle.markLoading();
    this.currentId = entry.id;
    try {
      const value = await loader.load(this.resolveSource(entry), entry);
      this.cache.set(entry.id, value);
      handle.markReady(value);
      this.loadedCount += 1;
      this.events?.emit('asset:progress', {
        loaded: this.loadedCount,
        total: this.totalRequested,
        id: entry.id,
      });
      this.currentId = null;
    } catch (error) {
      this.fail(handle, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private fail(handle: AssetHandle, error: Error): void {
    handle.markFailed(error);
    this.failedCount += 1;
    this.currentId = null;
    this.logger?.warn(`asset failed: ${handle.id}`, error.message);
    this.events?.emit('asset:failed', { id: handle.id, error });
  }

  /** Synchronous access once an asset is ready. */
  get<T = unknown>(id: string): T | undefined {
    return this.cache.get(id) as T | undefined;
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  handleFor(id: string): AssetHandle | undefined {
    return this.handles.get(id);
  }

  isLoading(id: string): boolean {
    const handle = this.handles.get(id);
    return handle ? handle.isLoading : false;
  }

  /* ------------------------------------------------------------------ bulk loading */

  /** Load every asset declared in the manifest. Failures are collected, never fatal. */
  async preloadAll(): Promise<PreloadReport> {
    if (!this.manifestValue) throw new Error('preloadAll requires a manifest; call loadManifest first');
    const started = Date.now();
    const entries = this.manifestValue.assets;
    this.events?.emit('asset:started', { count: entries.length });

    const results = await Promise.allSettled(entries.map((entry) => this.load(entry.id)));
    const failed: { id: string; error: string }[] = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed.push({ id: entries[index].id, error: String((result.reason as Error)?.message ?? result.reason) });
      }
    });

    const report: PreloadReport = {
      total: entries.length,
      loaded: entries.length - failed.length,
      failed,
      elapsedMs: Date.now() - started,
    };
    this.events?.emit('asset:complete', { count: report.loaded, elapsedMs: report.elapsedMs });
    return report;
  }

  /** Register an asset that was produced at runtime instead of loaded (solid colours, atlases). */
  registerAsset<T>(id: string, type: AssetType, value: T): AssetHandle<T> {
    const handle = new AssetHandle<T>(id, type, '<runtime>');
    this.cache.set(id, value);
    handle.markReady(value);
    this.handles.set(id, handle as AssetHandle);
    return handle;
  }

  /* ------------------------------------------------------------------ lifecycle */

  get progress(): AssetProgress {
    const total = this.totalRequested;
    return {
      loaded: this.loadedCount,
      total,
      ratio: total === 0 ? 1 : this.loadedCount / total,
      currentId: this.currentId,
    };
  }

  private get totalRequested(): number {
    return this.handles.size;
  }

  get stats(): { requested: number; loaded: number; failed: number; cached: number } {
    return {
      requested: this.totalRequested,
      loaded: this.loadedCount,
      failed: this.failedCount,
      cached: this.cache.size,
    };
  }

  /** Drop an asset and its handle so a later request reloads it (development hot reload). */
  unload(id: string): boolean {
    this.handles.delete(id);
    return this.cache.delete(id);
  }

  clear(): void {
    this.handles.clear();
    this.cache.clear();
    this.loadedCount = 0;
    this.failedCount = 0;
    this.currentId = null;
  }

  /** Build a manifest in code - used by tests and by the browser-first examples. */
  static manifestFrom(entries: AssetManifestEntry[], basePath?: string): AssetManifest {
    return createAssetManifest(entries, basePath);
  }
}
