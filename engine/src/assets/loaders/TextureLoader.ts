import { Texture } from '../../renderer/Texture';
import type { AssetLoader } from '../AssetManager';
import type { AssetManifestEntry } from '../AssetManifest';

/**
 * Decodes an image into a `Texture`.
 *
 * Uses `image.decode()` when available (it resolves after the bitmap is ready to paint, avoiding a
 * first-frame flash) and falls back to the load event. In a headless run there is no `Image`
 * constructor, and the failure is reported as an ordinary asset error so a game without textures
 * still runs in CI.
 */
export class TextureLoader implements AssetLoader<Texture> {
  readonly type = 'texture' as const;

  async load(source: string, entry: AssetManifestEntry): Promise<Texture> {
    if (typeof Image === 'undefined') {
      throw new Error(`TextureLoader cannot decode "${entry.id}" outside a browser (no Image constructor)`);
    }

    const image = new Image();
    // Textures live under the game's own origin; keep the canvas readable and avoid tainting it.
    image.crossOrigin = 'anonymous';

    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Failed to load texture "${entry.id}" from ${source}`));
    });

    image.src = source;
    if (typeof image.decode === 'function') {
      try {
        await image.decode();
      } catch {
        // decode() rejects for some formats that still fire onload; fall through to the event.
        await loaded;
      }
    } else {
      await loaded;
    }

    if (image.naturalWidth === 0) {
      throw new Error(`Texture "${entry.id}" decoded to zero width (${source})`);
    }
    return Texture.fromSource(image, { label: entry.id });
  }
}
