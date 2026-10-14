#!/usr/bin/env node
/**
 * Assembles the installable PWA into pwa/ from a single source of truth:
 *  - portal/{app.js,styles.css,data/builds.json} are copied verbatim (no forked logic)
 *  - portal/index.html gets the web-app metadata injected
 *  - pwa-src/{pwa.css,pwa.js,offline.html,manifest.template.json} are copied in
 *  - every built game under games/ is published to pwa/play/<id>/ so it can be played from the
 *    hosted site with nothing installed; pwa/data/games.json tells the portal where
 *  - sw.js gets a real precache list and a cache name derived from the shipped bytes
 *  - icons are reused from the committed pwa/icons, and only rendered (Windows PowerShell) when
 *    they are missing; screenshots come from the audit captures
 *
 * The site is assembled in a staging folder and swapped into place only when every step has
 * succeeded, so a failed build never leaves pwa/ empty or half-written.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

/** Same rule the game schema enforces; re-checked here because the id becomes a directory name. */
const GAME_ID = /^[a-z0-9][a-z0-9-]{1,62}$/;
/** Files in a game's dist/ that are build diagnostics, not part of the playable game. */
const PLAY_SKIP = new Set(['build-report.json']);
/** Published games are precached (playable offline) only while they stay under this budget. */
const PLAY_PRECACHE_LIMIT = 10 * 1024 * 1024;

const REQUIRED_ICONS = [
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon-180.png',
  'icons/favicon-32.png',
  'icons/favicon-16.png',
];

class BuildError extends Error {}

function fail(message) {
  throw new BuildError(message);
}

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function relFiles(root, dir = root) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...relFiles(root, full));
    else if (entry.isFile()) out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function screenshotSources(root, finalDir) {
  return {
    './screenshots/mobile-top.png': [
      path.join(root, 'selftest-pwa', 'pwa-mobile-top.png'),
      path.join(root, 'selftest-packaged', 'portal-mobile.png'),
      path.join(root, 'selftest', 'portal-mobile.png'),
      path.join(finalDir, 'screenshots', 'mobile-top.png'),
    ],
    './screenshots/desktop.png': [
      path.join(root, 'selftest-pwa', 'pwa-desktop.png'),
      path.join(root, 'selftest-packaged', 'portal-desktop.png'),
      path.join(root, 'selftest', 'portal-desktop.png'),
      path.join(finalDir, 'screenshots', 'desktop.png'),
    ],
  };
}

/* ---------------------------------------------------------------- icons */

/**
 * Icons are binary assets that only Windows PowerShell can render. They are committed, so reuse
 * them from the previous build (or the repository's pwa/) and render only what is truly missing.
 */
function ensureIcons(ctx) {
  const seeds = [ctx.final, path.join(ctx.root, 'pwa')];
  for (const rel of REQUIRED_ICONS) {
    const target = path.join(ctx.stage, rel);
    if (fs.existsSync(target)) continue;
    const seed = seeds.map((dir) => path.join(dir, rel)).find((p) => fs.existsSync(p));
    if (seed) copy(seed, target);
  }

  const missing = REQUIRED_ICONS.filter((rel) => !fs.existsSync(path.join(ctx.stage, rel)));
  if (!missing.length) return false;

  process.stdout.write('  rendering icons via make-pwa-icons.ps1\n');
  try {
    execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(ctx.root, 'scripts', 'make-pwa-icons.ps1'),
      '-OutDir', path.join(ctx.stage, 'icons'),
    ], { stdio: 'inherit' });
  } catch (error) {
    fail(
      `${missing.length} icon(s) are missing (${missing.join(', ')}) and could not be rendered ` +
      `because Windows PowerShell is unavailable (${error.code || error.message}). ` +
      'Restore pwa/icons from git (git checkout -- pwa/icons) or run this on Windows.'
    );
  }

  const stillMissing = REQUIRED_ICONS.filter((rel) => !fs.existsSync(path.join(ctx.stage, rel)));
  if (stillMissing.length) fail(`icon generation incomplete: ${stillMissing.join(', ')}`);
  return true;
}

/* ---------------------------------------------------------------- index.html */

function writeIndex(ctx) {
  const source = fs.readFileSync(path.join(ctx.portal, 'index.html'), 'utf8');
  const head = fs.readFileSync(path.join(ctx.src, 'head.html'), 'utf8').trim();

  if (!/name="viewport"/.test(source)) fail('portal/index.html has no viewport meta to upgrade');
  if (!source.includes('</head>')) fail('portal/index.html has no </head> to inject into');

  const html = source
    // safe-area aware viewport for notched devices
    .replace(
      /<meta name="viewport" content="[^"]*"\s*\/?>/,
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
    )
    .replace('</head>', `${head}\n</head>`);

  if (!html.includes('manifest.webmanifest')) fail('manifest link was not injected');
  if (!html.includes('viewport-fit=cover')) fail('viewport meta was not upgraded');

  fs.writeFileSync(path.join(ctx.stage, 'index.html'), html);
}

/* ---------------------------------------------------------------- manifest */

function writeManifest(ctx) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ctx.src, 'manifest.template.json'), 'utf8'));

  // Only advertise screenshots that actually exist, so the manifest stays valid.
  const shots = [];
  for (const [src, sources] of Object.entries(screenshotSources(ctx.root, ctx.final))) {
    const from = sources.find((p) => fs.existsSync(p));
    if (!from) continue;
    copy(from, path.join(ctx.stage, src.replace('./', '')));
    const declared = (manifest.screenshots || []).find((s) => s.src === src);
    if (declared) shots.push(declared);
  }
  if (shots.length) manifest.screenshots = shots;
  else delete manifest.screenshots;

  for (const icon of manifest.icons) {
    if (!fs.existsSync(path.join(ctx.stage, icon.src.replace('./', '')))) {
      fail(`manifest references a missing icon: ${icon.src}`);
    }
  }
  if (manifest.start_url !== './' || manifest.scope !== './') {
    fail('start_url/scope must stay relative so the app works when hosted under a sub-path');
  }

  fs.writeFileSync(path.join(ctx.stage, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/* ---------------------------------------------------------------- games */

/** Copy a built game into the site. Regular files only: a symlink in dist/ must never be followed. */
function copyDist(from, to) {
  const copied = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), next);
      else if (entry.isFile() && !(rel === '' && PLAY_SKIP.has(entry.name))) {
        copy(path.join(dir, entry.name), path.join(to, next));
        copied.push(next);
      }
    }
  };
  walk(from, '');
  return copied;
}

/**
 * Publish every successfully built game to <site>/play/<id>/ and rewrite the games index so the
 * portal knows where to send the player. Returns what was published and what was skipped, so the
 * caller can report it rather than silently shipping a Play button that leads nowhere.
 */
function publishGames(ctx) {
  const indexPath = path.join(ctx.portal, 'data', 'games.json');
  const result = { published: [], skipped: [], bytes: 0 };
  if (!fs.existsSync(indexPath)) return result;

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const rootReal = fs.realpathSync(ctx.root);
  const games = [];

  for (const game of Array.isArray(index.games) ? index.games : []) {
    const entry = { ...game, playPath: null };
    games.push(entry);
    if (!game.built || !game.distDir) continue;

    const skip = (reason) => result.skipped.push({ id: String(game.id), reason });

    if (typeof game.id !== 'string' || !GAME_ID.test(game.id)) { skip('id is not a valid game id'); continue; }

    const distAbs = path.resolve(ctx.root, String(game.distDir));
    let distReal;
    try { distReal = fs.realpathSync(distAbs); } catch { skip('build output folder is missing - run npm run games:build'); continue; }
    if (!isInside(rootReal, distReal)) { skip('build output resolves outside the repository'); continue; }
    if (!fs.existsSync(path.join(distReal, 'index.html'))) { skip('build output has no index.html'); continue; }

    const files = copyDist(distReal, path.join(ctx.stage, 'play', game.id));
    const bytes = files.reduce((sum, rel) => sum + fs.statSync(path.join(ctx.stage, 'play', game.id, rel)).size, 0);
    entry.playPath = `./play/${game.id}/`;
    result.published.push({ id: game.id, files: files.length, bytes });
    result.bytes += bytes;
  }

  fs.mkdirSync(path.join(ctx.stage, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ctx.stage, 'data', 'games.json'), JSON.stringify({ ...index, games }, null, 2) + '\n');
  return result;
}

/* ---------------------------------------------------------------- service worker */

function writeServiceWorker(ctx, play) {
  const precachePlay = play.published.length > 0 && play.bytes <= ctx.playPrecacheLimit;

  // Everything shipped except the worker itself and the build info file. Published games are left
  // out when they would make the first visit heavy; they are then cached as they are played.
  const files = relFiles(ctx.stage)
    .filter((rel) => !['sw.js', 'build-info.json'].includes(rel))
    .filter((rel) => precachePlay || !rel.startsWith('play/'));
  const directories = precachePlay ? play.published.map((game) => `play/${game.id}/`) : [];

  const precache = ['./', ...directories.map((rel) => `./${rel}`), ...files.map((rel) => `./${rel}`)].sort();

  const hash = crypto.createHash('sha256');
  for (const url of precache) {
    hash.update(url);
    hash.update('\0');
    const rel = url.replace('./', '');
    const file = path.join(ctx.stage, rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel);
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  const cacheVersion = 'gameforge-pwa-' + hash.digest('hex').slice(0, 12);

  let sw = fs.readFileSync(path.join(ctx.src, 'sw.js'), 'utf8');
  if (!sw.includes('__CACHE_VERSION__') || !sw.includes('__PRECACHE__')) {
    fail('pwa-src/sw.js is missing its build placeholders');
  }
  sw = sw
    .replace("'__CACHE_VERSION__'", JSON.stringify(cacheVersion))
    .replace('__PRECACHE__', JSON.stringify(precache, null, 2));

  fs.writeFileSync(path.join(ctx.stage, 'sw.js'), sw);
  return { cacheVersion, precache, precachePlay };
}

/* ---------------------------------------------------------------- main */

/**
 * @param {{root?: string, outDir?: string, playPrecacheLimit?: number, quiet?: boolean}} [options]
 */
function build(options = {}) {
  const root = options.root || ROOT;
  const final = options.outDir || path.join(root, 'pwa');
  const ctx = {
    root,
    final,
    src: path.join(root, 'pwa-src'),
    portal: path.join(root, 'portal'),
    stage: `${final}.build-${process.pid}`,
    playPrecacheLimit: options.playPrecacheLimit ?? PLAY_PRECACHE_LIMIT,
  };

  if (!fs.existsSync(ctx.portal)) fail('portal/ is missing - run the portal build first');

  fs.rmSync(ctx.stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(ctx.stage, 'data'), { recursive: true });
  fs.mkdirSync(path.join(ctx.stage, 'icons'), { recursive: true });

  try {
    copy(path.join(ctx.portal, 'app.js'), path.join(ctx.stage, 'app.js'));
    copy(path.join(ctx.portal, 'styles.css'), path.join(ctx.stage, 'styles.css'));
    // The games section is a separate script so the portal's own bundle stays untouched.
    for (const file of fs.readdirSync(path.join(ctx.portal, 'components'))) {
      copy(path.join(ctx.portal, 'components', file), path.join(ctx.stage, 'components', file));
    }
    // builds.json drives the payload index, games.json drives the Games section. Missing either
    // one degrades that section only. games.json is rewritten below to carry each game's playPath.
    for (const file of fs.readdirSync(path.join(ctx.portal, 'data'))) {
      copy(path.join(ctx.portal, 'data', file), path.join(ctx.stage, 'data', file));
    }
    copy(path.join(ctx.src, 'pwa.css'), path.join(ctx.stage, 'pwa.css'));
    copy(path.join(ctx.src, 'pwa.js'), path.join(ctx.stage, 'pwa.js'));
    copy(path.join(ctx.src, 'offline.html'), path.join(ctx.stage, 'offline.html'));

    writeIndex(ctx);
    const play = publishGames(ctx);
    const iconsRendered = ensureIcons(ctx);   // manifest validation below requires the icons on disk
    const manifest = writeManifest(ctx);
    const { cacheVersion, precache, precachePlay } = writeServiceWorker(ctx, play);

    const builds = JSON.parse(fs.readFileSync(path.join(ctx.stage, 'data', 'builds.json'), 'utf8'));
    const info = {
      generatedAt: new Date().toISOString(),
      cacheVersion,
      precacheEntries: precache.length,
      manifest: {
        name: manifest.name,
        display: manifest.display,
        icons: manifest.icons.length,
        screenshots: (manifest.screenshots || []).length,
        shortcuts: (manifest.shortcuts || []).length,
      },
      payload: builds.totals,
      play: {
        published: play.published.map((game) => game.id),
        bytes: play.bytes,
        precached: precachePlay,
        skipped: play.skipped,
      },
    };
    fs.writeFileSync(path.join(ctx.stage, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');

    const files = relFiles(ctx.stage);
    const bytes = files.reduce((sum, rel) => sum + fs.statSync(path.join(ctx.stage, rel)).size, 0);

    // Swap only after everything above succeeded.
    fs.rmSync(final, { recursive: true, force: true });
    fs.renameSync(ctx.stage, final);

    if (!options.quiet) {
      process.stdout.write(
        `pwa/ built: ${files.length} files, ${(bytes / 1024).toFixed(1)} KB, ` +
        `precache=${precache.length} entries, cache=${cacheVersion}` +
        `${iconsRendered ? ' (icons rendered)' : ''}\n` +
        `  play: ${play.published.length} game(s) published` +
        `${play.published.length ? ` (${play.published.map((g) => g.id).join(', ')}; ${precachePlay ? 'precached for offline play' : 'not precached: over budget'})` : ''}\n`
      );
      for (const item of play.skipped) process.stdout.write(`  play: skipped ${item.id} - ${item.reason}\n`);
    }
    return { precache, play, cacheVersion, outDir: final };
  } finally {
    fs.rmSync(ctx.stage, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    build();
  } catch (error) {
    process.stderr.write(`build-pwa: ${(error && error.message) || error}\n`);
    process.exit(1);
  }
}

module.exports = { build, publishGames, BuildError, OUT: path.join(ROOT, 'pwa') };
