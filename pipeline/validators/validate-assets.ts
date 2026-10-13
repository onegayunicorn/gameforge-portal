import fs from 'node:fs';
import path from 'node:path';
import { validateAssetManifest } from '../../engine/src/assets/AssetManifest';
import type { AssetManifest } from '../../engine/src/assets/AssetManifest';
import type { ValidationIssue } from './validate-game';

/** Extensions the pipeline knows how to classify; anything else ships as a plain file. */
const TYPE_BY_EXTENSION: Record<string, 'texture' | 'json' | 'text'> = {
  '.png': 'texture',
  '.jpg': 'texture',
  '.jpeg': 'texture',
  '.webp': 'texture',
  '.gif': 'texture',
  '.json': 'json',
  '.txt': 'text',
  '.md': 'text',
  '.glsl': 'text',
};

export interface ResolvedAsset {
  /** Path relative to the project root, using forward slashes. */
  relativePath: string;
  absolutePath: string;
  bytes: number;
  type: 'texture' | 'json' | 'text';
  /** Asset id used at runtime: path without extension, kebab-cased. */
  id: string;
}

export function assetTypeForFile(filePath: string): 'texture' | 'json' | 'text' {
  return TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'text';
}

/**
 * Turn `assets/player idle.png` into the stable id `player-idle`.
 *
 * The conventional `assets/` and `public/` roots are dropped so ids stay short and stable when a
 * project renames those folders, while any deeper folder is kept as a prefix to avoid collisions.
 */
export function assetIdForPath(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.[^./\\]+$/, '');
  const segments = withoutExtension.split(/[/\\]/).filter(Boolean);
  const tail = segments.length > 0 ? segments[segments.length - 1] : 'asset';
  const folders = segments.slice(0, -1).filter((segment) => segment !== 'assets' && segment !== 'public');
  return [...folders, tail]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Minimal glob matching.
 *
 * Supports the two forms games actually use - `dir/**\/*` and `dir/*.ext` - so the pipeline does
 * not need a glob dependency. `**` crosses directories, `*` does not.
 */
export function matchGlob(pattern: string, relativePath: string): boolean {
  const normalised = relativePath.split(path.sep).join('/');
  const escaped = pattern
    .split(path.sep).join('/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')   // placeholder for "any directory"
    .replace(/\*\*/g, '\u0001')     // placeholder for "anything"
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*');
  return new RegExp(`^${escaped}$`).test(normalised);
}

/** Walk a project directory, skipping the folders a build never ships. */
function walkFiles(root: string, dir: string = root): string[] {
  const skip = new Set(['node_modules', 'dist', '.git', '.vscode', '.cache']);
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(root, full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

export interface ResolveAssetsResult {
  assets: ResolvedAsset[];
  issues: ValidationIssue[];
  /** Files inside the project that no glob matched - usually a typo in the config. */
  unmatchedAssets: string[];
}

/** Resolve the project's asset globs into concrete files with stable ids. */
export function resolveProjectAssets(projectRoot: string, patterns: string[]): ResolveAssetsResult {
  const issues: ValidationIssue[] = [];
  const allFiles = walkFiles(projectRoot);
  const matched = new Set<string>();
  const assets: ResolvedAsset[] = [];
  const usedIds = new Map<string, string>();

  for (const pattern of patterns) {
    let matches = 0;
    for (const absolutePath of allFiles) {
      const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
      // Source and config files are never assets, even if a broad glob would catch them.
      if (relativePath.startsWith('src/') || relativePath === 'game.config.json' || relativePath === 'index.html') continue;
      if (!matchGlob(pattern, relativePath)) continue;

      matches += 1;
      if (matched.has(relativePath)) continue;
      matched.add(relativePath);

      const id = assetIdForPath(relativePath);
      const previous = usedIds.get(id);
      if (previous && previous !== relativePath) {
        issues.push({
          code: 'asset-id-collision',
          severity: 'error',
          file: relativePath,
          message: `Asset id "${id}" is produced by both ${previous} and ${relativePath}; rename one of them`,
        });
        continue;
      }
      usedIds.set(id, relativePath);

      assets.push({
        relativePath,
        absolutePath,
        bytes: fs.statSync(absolutePath).size,
        type: assetTypeForFile(absolutePath),
        id,
      });
    }

    if (matches === 0) {
      issues.push({
        code: 'asset-glob-empty',
        severity: 'warning',
        message: `Asset glob "${pattern}" matched no files`,
      });
    }
  }

  const unmatchedAssets = allFiles
    .map((absolutePath) => path.relative(projectRoot, absolutePath).split(path.sep).join('/'))
    .filter((relativePath) => !matched.has(relativePath)
      && !relativePath.startsWith('src/')
      && relativePath !== 'game.config.json'
      && relativePath !== 'index.html'
      && /\.(png|jpg|jpeg|webp|gif|mp3|ogg|wav|json|glsl)$/i.test(relativePath));

  return { assets: assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath)), issues, unmatchedAssets };
}

/** Final gate before writing a manifest: the runtime would reject a malformed one anyway. */
export function validateGeneratedManifest(manifest: AssetManifest): ValidationIssue[] {
  return validateAssetManifest(manifest).map((message) => ({
    code: 'manifest-invalid',
    severity: 'error' as const,
    message,
  }));
}
