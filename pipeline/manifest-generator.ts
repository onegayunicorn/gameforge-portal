import fs from 'node:fs';
import path from 'node:path';
import { createAssetManifest } from '../engine/src/assets/AssetManifest';
import type { AssetManifest, AssetManifestEntry } from '../engine/src/assets/AssetManifest';
import type { GameProject } from './project-discovery';
import { resolveGameDefaults } from './project-discovery';

/** The `game.json` the runtime reads. Shape must match `GameBuildInfo` in runtime/GameHost.ts. */
export interface GameBuildInfo {
  id: string;
  name: string;
  version: string;
  engine: string;
  width: number;
  height: number;
  clearColor: string;
  renderer: 'auto' | 'canvas2d' | 'webgl2';
  pixelArt: boolean;
  debug: boolean;
  entry: string;
  manifest: string | null;
  builtAt: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `#rgb`, `#rrggbb` and `#rrggbbaa` are all safe as CSS/HTML attribute values once validated. */
function safeColor(value: string): string {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ? value : '#0b1020';
}

export function generateAssetManifest(entries: AssetManifestEntry[], basePath: string = './'): AssetManifest {
  return createAssetManifest(
    [...entries].sort((a, b) => a.id.localeCompare(b.id)),
    basePath,
  );
}

export function writeAssetManifest(outDir: string, manifest: AssetManifest, fileName: string = 'manifest.json'): string {
  const target = path.join(outDir, fileName);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
  return target;
}

export interface RenderHtmlOptions {
  /** Template path. Defaults to runtime/index.html in the repository. */
  templatePath: string;
  /** Bundle filename loaded by the shell. */
  bundleFile?: string;
}

/**
 * Fill the runtime shell template.
 *
 * Every substitution is escaped, and the dimensions and colour are validated, so a hostile
 * `game.config.json` cannot inject markup into the generated page.
 */
export function renderRuntimeHtml(project: GameProject, options: RenderHtmlOptions): string {
  const defaults = resolveGameDefaults(project);
  const template = fs.readFileSync(options.templatePath, 'utf8');
  const replacements: Record<string, string> = {
    '{{GAME_NAME}}': escapeHtml(project.config.name),
    '{{GAME_ID}}': escapeHtml(project.config.id),
    '{{WIDTH}}': String(defaults.width),
    '{{HEIGHT}}': String(defaults.height),
    '{{CLEAR_COLOR}}': safeColor(defaults.clearColor),
  };

  let html = template;
  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }

  const bundleFile = options.bundleFile ?? 'engine.js';
  html = html.replace('./engine.js', `./${bundleFile}`);

  const unresolved = html.match(/\{\{[A-Z_]+\}\}/g);
  if (unresolved) {
    throw new Error(`Runtime template has unresolved placeholders: ${Array.from(new Set(unresolved)).join(', ')}`);
  }
  return html;
}

export function buildGameInfo(project: GameProject, options: { manifestFileName: string | null; entry: string }): GameBuildInfo {
  const defaults = resolveGameDefaults(project);
  return {
    id: project.config.id,
    name: project.config.name,
    version: project.config.version,
    engine: defaults.engine,
    width: defaults.width,
    height: defaults.height,
    clearColor: safeColor(defaults.clearColor),
    renderer: defaults.renderer,
    pixelArt: project.config.pixelArt ?? false,
    debug: project.config.debug ?? false,
    entry: options.entry,
    manifest: options.manifestFileName,
    builtAt: new Date().toISOString(),
  };
}

export function writeGameInfo(outDir: string, info: GameBuildInfo, fileName: string = 'game.json'): string {
  const target = path.join(outDir, fileName);
  fs.writeFileSync(target, `${JSON.stringify(info, null, 2)}\n`);
  return target;
}

export function writeRuntimeHtml(outDir: string, html: string, fileName: string = 'index.html'): string {
  const target = path.join(outDir, fileName);
  fs.writeFileSync(target, html);
  return target;
}
