export type AssetType = 'texture' | 'json' | 'text';

export const ASSET_MANIFEST_VERSION = 1;

export interface AssetManifestEntry {
  /** Stable id games use to request the asset. */
  id: string;
  type: AssetType;
  /** Path relative to the manifest's location. */
  source: string;
  /** Content hash written by the build pipeline, e.g. `sha256:1a2b...`. */
  hash?: string;
  /** Size in bytes, when the pipeline recorded it. */
  size?: number;
}

export interface AssetManifest {
  version: number;
  /** Base directory for relative sources; defaults to the manifest's own directory. */
  basePath?: string;
  assets: AssetManifestEntry[];
}

const KNOWN_TYPES: readonly AssetType[] = ['texture', 'json', 'text'];
const HASH_PATTERN = /^sha256:[0-9a-f]{8,64}$/i;

/**
 * Validate a manifest without loading anything.
 *
 * Returns a list of human-readable problems; an empty list means the manifest is usable. The build
 * pipeline calls this before writing a manifest, and the runtime calls it before preloading, so a
 * malformed manifest fails with a clear message instead of a mysterious 404 later.
 */
export function validateAssetManifest(manifest: unknown): string[] {
  const problems: string[] = [];
  if (typeof manifest !== 'object' || manifest === null) {
    return ['manifest must be an object'];
  }

  const candidate = manifest as Partial<AssetManifest>;
  if (candidate.version !== ASSET_MANIFEST_VERSION) {
    problems.push(`version must be ${ASSET_MANIFEST_VERSION}, received ${String(candidate.version)}`);
  }
  if (!Array.isArray(candidate.assets)) {
    problems.push('assets must be an array');
    return problems;
  }

  const seen = new Set<string>();
  candidate.assets.forEach((entry, index) => {
    const at = `assets[${index}]`;
    if (typeof entry !== 'object' || entry === null) {
      problems.push(`${at} must be an object`);
      return;
    }
    const item = entry as Partial<AssetManifestEntry>;
    if (typeof item.id !== 'string' || item.id.length === 0) problems.push(`${at}.id must be a non-empty string`);
    else if (seen.has(item.id)) problems.push(`${at}.id "${item.id}" is duplicated`);
    else seen.add(item.id);

    if (typeof item.type !== 'string' || !KNOWN_TYPES.includes(item.type as AssetType)) {
      problems.push(`${at}.type must be one of ${KNOWN_TYPES.join(', ')}`);
    }
    if (typeof item.source !== 'string' || item.source.length === 0) {
      problems.push(`${at}.source must be a non-empty string`);
    }
    if (item.hash !== undefined && !HASH_PATTERN.test(item.hash)) {
      problems.push(`${at}.hash must look like sha256:<hex>`);
    }
    if (item.size !== undefined && (!Number.isInteger(item.size) || (item.size as number) < 0)) {
      problems.push(`${at}.size must be a non-negative integer`);
    }
  });

  return problems;
}

/** Parse and validate; throws a single error listing every problem found. */
export function parseAssetManifest(data: unknown): AssetManifest {
  const problems = validateAssetManifest(data);
  if (problems.length > 0) {
    throw new Error(`Invalid asset manifest:\n  - ${problems.join('\n  - ')}`);
  }
  return data as AssetManifest;
}

/** Build a manifest from entries, used by the pipeline and by tests. */
export function createAssetManifest(assets: AssetManifestEntry[], basePath?: string): AssetManifest {
  return { version: ASSET_MANIFEST_VERSION, basePath, assets };
}

export function findManifestEntry(manifest: AssetManifest, id: string): AssetManifestEntry | undefined {
  return manifest.assets.find((entry) => entry.id === id);
}
