#!/usr/bin/env node
/**
 * Assembles the installable PWA into pwa/ from a single source of truth:
 *  - portal/{app.js,styles.css,data/builds.json} are copied verbatim (no forked logic)
 *  - portal/index.html gets the web-app metadata injected
 *  - pwa-src/{pwa.css,pwa.js,offline.html,manifest.template.json} are copied in
 *  - sw.js gets a real precache list and a cache name derived from the shipped bytes
 *  - icons are rendered by make-pwa-icons.ps1, screenshots come from the audit captures
 * Re-running it always produces a byte-identical tree if nothing changed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'pwa-src');
const PORTAL = path.join(ROOT, 'portal');
const OUT = path.join(ROOT, 'pwa');

const SCREENSHOT_SOURCES = {
  './screenshots/mobile-top.png': [
    path.join(ROOT, 'selftest-pwa', 'pwa-mobile-top.png'),
    path.join(ROOT, 'selftest-packaged', 'portal-mobile.png'),
    path.join(ROOT, 'selftest', 'portal-mobile.png'),
  ],
  './screenshots/desktop.png': [
    path.join(ROOT, 'selftest-pwa', 'pwa-desktop.png'),
    path.join(ROOT, 'selftest-packaged', 'portal-desktop.png'),
    path.join(ROOT, 'selftest', 'portal-desktop.png'),
  ],
};

const REQUIRED_ICONS = [
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon-180.png',
  'icons/favicon-32.png',
  'icons/favicon-16.png',
];

function fail(message) {
  process.stderr.write(`build-pwa: ${message}\n`);
  process.exit(1);
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

/* ---------------------------------------------------------------- icons */

function ensureIcons() {
  const missing = REQUIRED_ICONS.filter((rel) => !fs.existsSync(path.join(OUT, rel)));
  if (!missing.length) return false;

  process.stdout.write('  rendering icons via make-pwa-icons.ps1\n');
  execFileSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(__dirname, 'make-pwa-icons.ps1'),
    '-OutDir', path.join(OUT, 'icons'),
  ], { stdio: 'inherit' });

  const stillMissing = REQUIRED_ICONS.filter((rel) => !fs.existsSync(path.join(OUT, rel)));
  if (stillMissing.length) fail(`icon generation incomplete: ${stillMissing.join(', ')}`);
  return true;
}

/* ---------------------------------------------------------------- index.html */

function writeIndex() {
  const source = fs.readFileSync(path.join(PORTAL, 'index.html'), 'utf8');
  const head = fs.readFileSync(path.join(SRC, 'head.html'), 'utf8').trim();

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

  fs.writeFileSync(path.join(OUT, 'index.html'), html);
}

/* ---------------------------------------------------------------- manifest */

function writeManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.template.json'), 'utf8'));

  // Only advertise screenshots that actually exist, so the manifest stays valid.
  const shots = [];
  for (const [src, sources] of Object.entries(SCREENSHOT_SOURCES)) {
    const from = sources.find((p) => fs.existsSync(p));
    if (!from) continue;
    copy(from, path.join(OUT, src.replace('./', '')));
    const declared = (manifest.screenshots || []).find((s) => s.src === src);
    if (declared) shots.push(declared);
  }
  if (shots.length) manifest.screenshots = shots;
  else delete manifest.screenshots;

  for (const icon of manifest.icons) {
    if (!fs.existsSync(path.join(OUT, icon.src.replace('./', '')))) {
      fail(`manifest references a missing icon: ${icon.src}`);
    }
  }
  if (manifest.start_url !== './' || manifest.scope !== './') {
    fail('start_url/scope must stay relative so the app works when hosted under a sub-path');
  }

  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/* ---------------------------------------------------------------- service worker */

function writeServiceWorker() {
  // Everything shipped except the worker itself and the build info file.
  const precache = [
    './',
    ...relFiles(OUT)
      .filter((rel) => !['sw.js', 'build-info.json'].includes(rel))
      .map((rel) => `./${rel}`),
  ].sort();

  const hash = crypto.createHash('sha256');
  for (const url of precache) {
    hash.update(url);
    hash.update('\0');
    const file = url === './' ? path.join(OUT, 'index.html') : path.join(OUT, url.replace('./', ''));
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  const cacheVersion = 'gameforge-pwa-' + hash.digest('hex').slice(0, 12);

  let sw = fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8');
  if (!sw.includes('__CACHE_VERSION__') || !sw.includes('__PRECACHE__')) {
    fail('pwa-src/sw.js is missing its build placeholders');
  }
  sw = sw
    .replace("'__CACHE_VERSION__'", JSON.stringify(cacheVersion))
    .replace('__PRECACHE__', JSON.stringify(precache, null, 2));

  fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
  return { cacheVersion, precache };
}

/* ---------------------------------------------------------------- main */

function build() {
  if (!fs.existsSync(PORTAL)) fail('portal/ is missing - run the portal build first');

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });

  copy(path.join(PORTAL, 'app.js'), path.join(OUT, 'app.js'));
  copy(path.join(PORTAL, 'styles.css'), path.join(OUT, 'styles.css'));
  copy(path.join(PORTAL, 'data', 'builds.json'), path.join(OUT, 'data', 'builds.json'));
  copy(path.join(SRC, 'pwa.css'), path.join(OUT, 'pwa.css'));
  copy(path.join(SRC, 'pwa.js'), path.join(OUT, 'pwa.js'));
  copy(path.join(SRC, 'offline.html'), path.join(OUT, 'offline.html'));

  writeIndex();
  const iconsRendered = ensureIcons();   // manifest validation below requires the icons on disk
  const manifest = writeManifest();
  const { cacheVersion, precache } = writeServiceWorker();

  const builds = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'builds.json'), 'utf8'));
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
  };
  fs.writeFileSync(path.join(OUT, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');

  const bytes = relFiles(OUT).reduce((a, rel) => a + fs.statSync(path.join(OUT, rel)).size, 0);
  process.stdout.write(
    `pwa/ built: ${relFiles(OUT).length} files, ${(bytes / 1024).toFixed(1)} KB, ` +
    `precache=${precache.length} entries, cache=${cacheVersion}` +
    `${iconsRendered ? ' (icons rendered)' : ''}\n`
  );
}

if (require.main === module) build();

module.exports = { build, OUT };
