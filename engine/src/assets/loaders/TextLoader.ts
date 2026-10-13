import type { AssetLoader } from '../AssetManager';
import type { AssetManifestEntry } from '../AssetManifest';

/** Fetches a plain-text asset: shader source, dialogue, level data in a custom format. */
export class TextLoader implements AssetLoader<string> {
  readonly type = 'text' as const;

  constructor(private readonly fetchImpl: typeof fetch = globalThis.fetch) {}

  async load(source: string, entry: AssetManifestEntry): Promise<string> {
    const response = await this.fetchImpl(source, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load text "${entry.id}": HTTP ${response.status} for ${source}`);
    }
    return response.text();
  }
}
