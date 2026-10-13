import type { AssetLoader } from '../AssetManager';
import type { AssetManifestEntry } from '../AssetManifest';

/** Fetches and parses a JSON asset. Scene files, tile data and tuning tables all use this. */
export class JsonLoader implements AssetLoader<unknown> {
  readonly type = 'json' as const;

  constructor(private readonly fetchImpl: typeof fetch = globalThis.fetch) {}

  async load(source: string, entry: AssetManifestEntry): Promise<unknown> {
    const response = await this.fetchImpl(source, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load JSON "${entry.id}": HTTP ${response.status} for ${source}`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new Error(`Asset "${entry.id}" is not valid JSON (${source}): ${(error as Error).message}`);
    }
  }
}
