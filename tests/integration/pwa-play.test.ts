import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { build } = require('../../scripts/build-pwa.js') as {
  build: (options: { root: string; outDir: string; playPrecacheLimit?: number; quiet?: boolean }) => {
    precache: string[];
    play: { published: Array<{ id: string }>; skipped: Array<{ id: string; reason: string }>; bytes: number };
  };
};

const repoRoot = process.cwd();

interface FakeGame {
  id: string;
  built?: boolean;
  distDir?: string;
}

/**
 * A throwaway repository root: the real portal and pwa-src (so the real templates are exercised),
 * the committed icons, and fake game builds. Nothing here touches the real pwa/ folder.
 */
function makeRoot(games: FakeGame[], dists: Record<string, Record<string, string>> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gameforge-pwa-'));
  fs.cpSync(path.join(repoRoot, 'portal'), path.join(root, 'portal'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'pwa-src'), path.join(root, 'pwa-src'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'pwa', 'icons'), path.join(root, 'pwa', 'icons'), { recursive: true });

  for (const [distDir, files] of Object.entries(dists)) {
    for (const [name, body] of Object.entries(files)) {
      const target = path.join(root, distDir, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
    }
  }

  const index = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    games: games.map((game) => ({ name: game.id, version: '0.0.1', ...game, built: game.built ?? true })),
  };
  fs.writeFileSync(path.join(root, 'portal', 'data', 'games.json'), JSON.stringify(index));
  return { root, out: path.join(root, 'site-out') };
}

const DIST = {
  'index.html': '<!doctype html><title>fake</title><script type="module" src="./engine.js"></script>',
  'engine.js': 'export {};',
  'game.json': '{"id":"fake-game"}',
  'build-report.json': '{"outDir":"C:\\\\Users\\\\someone\\\\private"}',
  'assets/player.png': 'png',
};

function readIndex(out: string) {
  return JSON.parse(fs.readFileSync(path.join(out, 'data', 'games.json'), 'utf8')) as {
    games: Array<{ id: string; playPath: string | null }>;
  };
}

describe('hosted browser play', () => {
  it('publishes a built game under play/<id>/ and points the index at it', () => {
    const { root, out } = makeRoot(
      [{ id: 'fake-game', distDir: 'games/fake-game/dist' }, { id: 'unbuilt-game', built: false }],
      { 'games/fake-game/dist': DIST },
    );

    const result = build({ root, outDir: out, quiet: true });

    for (const file of ['index.html', 'engine.js', 'game.json', 'assets/player.png']) {
      expect(fs.existsSync(path.join(out, 'play', 'fake-game', file)), `missing ${file}`).toBe(true);
    }
    // Build diagnostics can contain local paths and are not part of the playable game.
    expect(fs.existsSync(path.join(out, 'play', 'fake-game', 'build-report.json'))).toBe(false);

    const games = readIndex(out).games;
    expect(games.find((g) => g.id === 'fake-game')?.playPath).toBe('./play/fake-game/');
    expect(games.find((g) => g.id === 'unbuilt-game')?.playPath).toBeNull();
    expect(result.play.published.map((g) => g.id)).toEqual(['fake-game']);
  });

  it('precaches published games so they play offline, and every precache entry exists', () => {
    const { root, out } = makeRoot([{ id: 'fake-game', distDir: 'games/fake-game/dist' }], { 'games/fake-game/dist': DIST });

    const { precache } = build({ root, outDir: out, quiet: true });

    expect(precache).toContain('./play/fake-game/');
    expect(precache).toContain('./play/fake-game/index.html');
    for (const url of precache) {
      const rel = url.replace('./', '');
      const file = path.join(out, rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel);
      expect(fs.existsSync(file), `precache entry ${url} is not shipped`).toBe(true);
    }
    // The worker must carry the same list the build computed.
    const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
    expect(sw).toContain('"./play/fake-game/index.html"');
  });

  it('still publishes, but does not precache, a game over the offline budget', () => {
    const { root, out } = makeRoot([{ id: 'fake-game', distDir: 'games/fake-game/dist' }], { 'games/fake-game/dist': DIST });

    const { precache, play } = build({ root, outDir: out, playPrecacheLimit: 10, quiet: true });

    expect(play.published).toHaveLength(1);
    expect(fs.existsSync(path.join(out, 'play', 'fake-game', 'index.html'))).toBe(true);
    expect(precache.some((url) => url.startsWith('./play/'))).toBe(false);
  });

  it('refuses an id that is not a valid game id instead of writing outside play/', () => {
    const { root, out } = makeRoot([{ id: '../evil', distDir: 'games/fake-game/dist' }], { 'games/fake-game/dist': DIST });

    const { play } = build({ root, outDir: out, quiet: true });

    expect(play.published).toEqual([]);
    expect(play.skipped[0]?.id).toBe('../evil');
    expect(fs.existsSync(path.join(out, 'evil'))).toBe(false);
    expect(readIndex(out).games[0]?.playPath).toBeNull();
  });

  it('does not publish a build folder that resolves outside the repository', () => {
    const { root, out } = makeRoot([{ id: 'sneaky-game', distDir: 'games/sneaky/dist' }]);
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'gameforge-outside-'));
    fs.writeFileSync(path.join(outside, 'index.html'), 'secret');
    fs.mkdirSync(path.join(root, 'games', 'sneaky'), { recursive: true });
    try {
      fs.symlinkSync(outside, path.join(root, 'games', 'sneaky', 'dist'), 'dir');
    } catch {
      return; // symlinks need extra rights on Windows; the guard is exercised on POSIX CI
    }

    const { play } = build({ root, outDir: out, quiet: true });

    expect(play.published).toEqual([]);
    expect(play.skipped[0]?.reason).toMatch(/outside the repository/);
    expect(fs.existsSync(path.join(out, 'play', 'sneaky-game'))).toBe(false);
  });

  it('reports a built game whose output folder is missing rather than shipping a dead Play button', () => {
    const { root, out } = makeRoot([{ id: 'ghost-game', distDir: 'games/ghost/dist' }]);

    const { play } = build({ root, outDir: out, quiet: true });

    expect(play.published).toEqual([]);
    expect(play.skipped[0]?.reason).toMatch(/missing/);
    expect(readIndex(out).games[0]?.playPath).toBeNull();
  });

  it('leaves the existing site untouched when the build fails', () => {
    const { root, out } = makeRoot([{ id: 'fake-game', distDir: 'games/fake-game/dist' }], { 'games/fake-game/dist': DIST });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'previous-site.txt'), 'still here');
    fs.writeFileSync(path.join(root, 'portal', 'index.html'), '<html><meta name="viewport" content="x"></html>');

    expect(() => build({ root, outDir: out, quiet: true })).toThrow(/<\/head>/);

    expect(fs.readFileSync(path.join(out, 'previous-site.txt'), 'utf8')).toBe('still here');
    expect(fs.readdirSync(root).filter((name) => name.includes('.build-'))).toEqual([]);
  });

  it('renders no icons on a machine without PowerShell when the committed icons exist', () => {
    const { root, out } = makeRoot([]);
    expect(() => build({ root, outDir: out, quiet: true })).not.toThrow();
    for (const icon of ['icon-192.png', 'icon-512.png', 'maskable-512.png']) {
      expect(fs.existsSync(path.join(out, 'icons', icon)), icon).toBe(true);
    }
  });
});
