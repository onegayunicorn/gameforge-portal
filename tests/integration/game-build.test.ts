import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildGame, verifyBuildOutput } from '../../pipeline/game-builder';
import { loadGameProject } from '../../pipeline/project-discovery';
import { parseAssetManifest } from '../../engine/src/assets/AssetManifest';

const repoRoot = process.cwd();
const exampleProject = path.join(repoRoot, 'games', 'examples', 'hello-render');

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sha256(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

describe('game build pipeline', () => {
  it('builds the example game into a self-contained, verified folder', async () => {
    const outDir = path.join(makeTempDir('gameforge-build-'), 'dist');

    const { report, info } = await buildGame({ projectDir: exampleProject, repoRoot, outDir, minify: false });

    expect(report.status).toBe('success');
    expect(report.errors).toEqual([]);
    expect(info).not.toBeNull();

    // Every file the runtime needs must exist.
    for (const file of ['index.html', 'engine.js', 'game.js', 'runtime.css', 'game.json', 'manifest.json', 'build-report.json']) {
      expect(fs.existsSync(path.join(outDir, file)), `missing ${file}`).toBe(true);
    }

    // The report is written to disk as well as returned, so the portal can read it without a build.
    const onDisk = JSON.parse(fs.readFileSync(path.join(outDir, 'build-report.json'), 'utf8'));
    expect(onDisk.gameId).toBe('hello-render');
    expect(onDisk.status).toBe('success');
    expect(onDisk.outputs.length).toBeGreaterThan(4);
    expect(onDisk.outputBytes).toBeGreaterThan(1000);

    // The shell must load the bundle and have no unresolved template tokens.
    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    expect(html).toContain('./engine.js');
    expect(html).toContain('Hello Render');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(html).toContain('Content-Security-Policy');

    // The manifest must validate and its hashes must match the shipped bytes.
    const manifest = parseAssetManifest(JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8')));
    expect(manifest.assets).toHaveLength(1);
    const entry = manifest.assets[0];
    expect(entry.id).toBe('player');
    expect(entry.type).toBe('texture');
    expect(fs.existsSync(path.join(outDir, entry.source))).toBe(true);
    expect(entry.hash).toBe(sha256(path.join(outDir, entry.source)));
    expect(entry.size).toBe(fs.statSync(path.join(outDir, entry.source)).size);

    // The pipeline's own integrity check must agree.
    expect(verifyBuildOutput(outDir, info!)).toEqual([]);

    // The game module is a separate chunk from the runtime, sharing the engine chunk.
    const chunkCount = fs.readdirSync(outDir).filter((file) => file.startsWith('chunk-')).length;
    expect(chunkCount).toBeGreaterThanOrEqual(1);
    expect(report.bundles.length).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it('fails a project whose entry module does not exist, and says why', async () => {
    const projectDir = makeTempDir('gameforge-bad-');
    fs.writeFileSync(path.join(projectDir, 'game.config.json'), JSON.stringify({
      id: 'broken-game',
      name: 'Broken Game',
      version: '0.1.0',
      entry: 'src/missing.ts',
    }, null, 2));

    const outDir = path.join(projectDir, 'dist');
    const { report } = await buildGame({ projectDir, repoRoot, outDir });

    expect(report.status).toBe('failed');
    expect(report.errors.map((issue) => issue.code)).toContain('entry-missing');
    // A failed validation must not leave a half-written build behind.
    expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(false);
  });

  it('rejects an invalid game id before building', async () => {
    const projectDir = makeTempDir('gameforge-invalid-');
    fs.writeFileSync(path.join(projectDir, 'game.config.json'), JSON.stringify({
      id: 'Not Kebab Case',
      name: 'Invalid',
      version: '0.1.0',
      entry: 'src/main.ts',
    }, null, 2));

    // loadGameProject validates synchronously, so the throw happens before any promise exists.
    expect(() => loadGameProject(projectDir)).toThrow(/not valid/i);
  });

  it('warns about assets no glob matches so they cannot ship silently', async () => {
    const projectDir = makeTempDir('gameforge-unmatched-');
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'sprites'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'src', 'main.ts'), 'export function setup(): void {}\n');
    fs.writeFileSync(path.join(projectDir, 'sprites', 'orphan.png'), 'not really a png');
    fs.writeFileSync(path.join(projectDir, 'game.config.json'), JSON.stringify({
      id: 'unmatched-assets',
      name: 'Unmatched Assets',
      version: '0.1.0',
      entry: 'src/main.ts',
      assets: ['assets/**/*'],
    }, null, 2));

    const outDir = path.join(projectDir, 'dist');
    const { report } = await buildGame({ projectDir, repoRoot, outDir, minify: false });

    expect(report.status).toBe('success');
    expect(report.warnings.map((issue) => issue.code)).toContain('unreferenced-assets');
    expect(report.assetCount).toBe(0);
  }, 60_000);
});
