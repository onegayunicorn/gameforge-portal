import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveProjectAssets } from './validators/validate-assets';
import type { GameProject } from './project-discovery';
import type { AssetManifestEntry } from '../engine/src/assets/AssetManifest';
import type { ValidationIssue } from './validators/validate-game';

export interface ProcessedAsset {
  id: string;
  type: 'texture' | 'json' | 'text';
  /** Path relative to the project root. */
  source: string;
  /** Path relative to the output directory. */
  output: string;
  bytes: number;
  /** `sha256:<hex>` of the shipped bytes. */
  hash: string;
}

export interface AssetPipelineResult {
  entries: AssetManifestEntry[];
  assets: ProcessedAsset[];
  totalBytes: number;
  issues: ValidationIssue[];
  unmatchedAssets: string[];
}

export function hashBuffer(data: Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
}

/**
 * Copy the project's assets into the build output and hash them.
 *
 * Files are copied (not linked) and hashed from the bytes that actually land in `dist/`, so the
 * manifest describes the shipped artifact rather than the source tree - that is what makes the
 * manifest usable as a cache key and an integrity record.
 */
export function processAssets(project: GameProject, outDir: string): AssetPipelineResult {
  const patterns = project.config.assets ?? [];
  const { assets, issues, unmatchedAssets } = resolveProjectAssets(project.root, patterns);

  const entries: AssetManifestEntry[] = [];
  const processed: ProcessedAsset[] = [];
  let totalBytes = 0;

  for (const asset of assets) {
    // The project's own folder layout is preserved (assets/foo.png stays assets/foo.png), so the
    // manifest source is the same path the glob matched and nothing is nested twice.
    const outputRelative = asset.relativePath;
    const outputPath = path.join(outDir, outputRelative);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const data = fs.readFileSync(asset.absolutePath);
    fs.writeFileSync(outputPath, data);

    const hash = hashBuffer(data);
    totalBytes += data.byteLength;

    processed.push({
      id: asset.id,
      type: asset.type,
      source: asset.relativePath,
      output: outputRelative.split(path.sep).join('/'),
      bytes: data.byteLength,
      hash,
    });

    entries.push({
      id: asset.id,
      type: asset.type,
      source: outputRelative.split(path.sep).join('/'),
      hash,
      size: data.byteLength,
    });
  }

  return { entries, assets: processed, totalBytes, issues, unmatchedAssets };
}

/** Scene files are copied verbatim; the runtime parses them, the pipeline only ships them. */
export function copySceneFiles(project: GameProject, outDir: string, scenesSubdir: string = 'scenes'): string[] {
  const copied: string[] = [];
  for (const scene of project.config.scenes ?? []) {
    const from = path.resolve(project.root, scene);
    if (!fs.existsSync(from)) continue;
    const to = path.join(outDir, scenesSubdir, path.basename(scene));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied.push(path.posix.join(scenesSubdir, path.basename(scene)));
  }
  return copied;
}

/** Static files that ship beside the bundle (favicon, robots, audio not covered by globs). */
export function copyPublicDir(project: GameProject, outDir: string, publicDir: string = 'public'): string[] {
  const from = path.join(project.root, publicDir);
  if (!fs.existsSync(from)) return [];
  const copied: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const source = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(source);
        continue;
      }
      const relative = path.relative(from, source);
      const target = path.join(outDir, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      copied.push(relative.split(path.sep).join('/'));
    }
  };
  walk(from);
  return copied;
}
