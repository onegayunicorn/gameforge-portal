#!/usr/bin/env node
/**
 * Scans the embedded game-platform build payload and emits portal/data/builds.json.
 * All values are derived from the real files on disk - nothing is hard-coded.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = path.join(__dirname, '..');

/** Resolve the directories used by a scan (overridable so the packaged app can scan its resources). */
function resolvePaths(opts = {}) {
  const base = opts.root || DEFAULT_ROOT;
  return {
    payload: opts.payloadDir || path.join(base, 'payload'),
    meta: opts.metaDir || path.join(base, 'build-meta'),
    out: opts.outPath === null ? null : opts.outPath || path.join(base, 'portal', 'data', 'builds.json'),
  };
}

function walk(dir, base = dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (e.isDirectory()) walk(full, base, out);
    else if (e.isFile()) {
      let size = 0;
      try { size = fs.statSync(full).size; } catch { /* ignore */ }
      out.push({ rel, size, full });
    }
  }
  return out;
}

function readIfPresent(p, limit) {
  try {
    const buf = fs.readFileSync(p);
    const text = buf.toString('utf8');
    return limit ? text.slice(0, limit) : text;
  } catch {
    return null;
  }
}

function firstHeading(md) {
  if (!md) return null;
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^#{1,2}\s+(.*)$/);
    if (m) return m[1].replace(/[*`]/g, '').trim();
  }
  return null;
}

function summarise(readme) {
  if (!readme) return null;
  const lines = readme.split(/\r?\n/);
  const buf = [];
  let started = false;
  for (const line of lines) {
    if (/^#{1,2}\s/.test(line)) {
      if (started) break;
      started = true;
      continue;
    }
    if (!started) continue;
    if (/^[>|`\-*]/.test(line) && !line.trim()) continue;
    if (!line.trim()) { if (buf.length) break; else continue; }
    buf.push(line.trim());
    if (buf.join(' ').length > 320) break;
  }
  return buf.join(' ').replace(/[*`|]/g, '').replace(/\s+/g, ' ').trim() || null;
}

function dirListing(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .map((e) => ({ name: e.name, dir: e.isDirectory() }))
      .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  } catch {
    return [];
  }
}

/** Resolve the real content root: unwrap single-directory wrappers (e.g. *-BUILT/ or *-build/). */
function resolveRoot(dir) {
  let current = dir;
  for (let i = 0; i < 3; i += 1) {
    const kids = dirListing(current);
    if (kids.length === 1 && kids[0].dir) current = path.join(current, kids[0].name);
    else break;
  }
  return current;
}

/** Find a directory of the given name anywhere in the tree (BFS). */
function findDir(root, name) {
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    for (const e of dirListing(dir)) {
      if (!e.dir) continue;
      if (e.name === name) return path.join(dir, e.name);
      queue.push(path.join(dir, e.name));
    }
  }
  return null;
}

function detectKind(files, topNames, pkg) {
  const has = (n) => topNames.includes(n);
  if (has('marketplace') && has('platform')) return 'Multi-product universe';
  if (has('apps') && has('packages') && has('content')) return 'Game monorepo (HTML5/WebGL)';
  if (has('apps') && has('packages') && has('adapters') && has('targets')) return 'Platform monorepo';
  if (pkg && pkg.name) return 'Application package';
  return 'Source tree';
}

function countUnder(files, prefix) {
  const p = prefix + '/';
  return files.filter((f) => f.rel.startsWith(p)).length;
}

/** Count files living under any directory with this basename, at any depth. */
function countAnyDir(files, name) {
  return files.filter((f) => f.rel.split('/').slice(0, -1).includes(name)).length;
}

const PROJECTS = [
  {
    id: 'universal-game-platform',
    dir: 'universal-game-platform',
    label: 'Universal Game Platform',
    accent: '#6ea8ff',
    badge: 'Platform',
    archive: 'universal-game-platform-v1.0.0-BUILT.zip',
  },
  {
    id: 'sovereign-game-universe',
    dir: 'sovereign-game-universe',
    label: 'Sovereign Game Universe',
    accent: '#b78cff',
    badge: 'Universe',
    archive: 'sovereign-game-universe-v1.0.0.zip',
  },
  {
    id: 'monolith-bay',
    dir: 'monolith-bay',
    label: 'Monolith Bay',
    accent: '#4ed6b8',
    badge: 'Game',
    archive: null,
  },
];

function sha256File(p) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  } catch {
    return null;
  }
}

/** Order-independent content digest of the whole tree. */
function treeDigest(files) {
  const h = crypto.createHash('sha256');
  const sorted = [...files].sort((a, b) => a.rel.localeCompare(b.rel));
  for (const f of sorted) {
    h.update(f.rel);
    h.update('\0');
    h.update(String(f.size));
    h.update('\0');
    try { h.update(crypto.createHash('sha256').update(fs.readFileSync(f.full)).digest()); } catch { /* ignore */ }
    h.update('\0');
  }
  return h.digest('hex');
}

/** Expected archive digests recorded in the supplied .sha256 sidecars. */
function readSidecars(META) {
  const result = {};
  let names = [];
  try { names = fs.readdirSync(META); } catch { return result; }
  for (const n of names) {
    if (!n.endsWith('.sha256')) continue;
    const text = readIfPresent(path.join(META, n));
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
      if (m) result[m[2].trim()] = m[1].toLowerCase();
    }
  }
  return result;
}

function build(opts = {}) {
  const { payload: PAYLOAD, meta: META, out: OUT } = resolvePaths(opts);
  const sidecars = readSidecars(META);
  const projects = [];

  for (const spec of PROJECTS) {
    const outer = path.join(PAYLOAD, spec.dir);
    if (!fs.existsSync(outer)) continue;
    const root = resolveRoot(outer);
    const files = walk(root);
    const topNames = dirListing(root).map((e) => e.name);

    const pkgPath = path.join(root, 'package.json');
    let pkg = null;
    const pkgText = readIfPresent(pkgPath);
    if (pkgText) { try { pkg = JSON.parse(pkgText); } catch { pkg = null; } }

    const readmeFile = fs.existsSync(path.join(root, 'README.md'))
      ? path.join(root, 'README.md')
      : files.find((f) => /^readme\.md$/i.test(path.basename(f.rel)))?.full || null;
    const readme = readIfPresent(readmeFile, 20000);

    const docsDir = findDir(root, 'docs');
    const docs = docsDir
      ? dirListing(docsDir)
          .filter((d) => !d.dir)
          .map((d) => d.name)
      : [];

    const targetsDir = findDir(root, 'targets');
    const adaptersDir = findDir(root, 'adapters');

    const dirs = dirListing(root).filter((e) => e.dir);
    const modules = {};
    for (const d of dirs) {
      const n = countUnder(files, d.name);
      if (n) modules[d.name] = n;
    }

    const bytes = files.reduce((a, f) => a + f.size, 0);
    const dirNames = files.map((f) => f.rel.split('/').slice(0, -1)).flat();

    const subProducts = ['platform', 'marketplace', 'server', 'projects', 'game', 'dist', 'release']
      .filter((n) => dirs.some((d) => d.name === n))
      .map((n) => ({ name: n, files: countUnder(files, n) }));

    projects.push({
      id: spec.id,
      label: spec.label,
      badge: spec.badge,
      accent: spec.accent,
      kind: detectKind(files, topNames, pkg),
      packageName: pkg?.name || null,
      version: pkg?.version || null,
      packageManager: pkg?.packageManager || null,
      description: pkg?.description || summarise(readme) || null,
      readmeTitle: firstHeading(readme),
      readmeExcerpt: summarise(readme),
      fileCount: files.length,
      dirCount: dirs.length,
      bytes,
      modules,
      docs,
      topLevel: dirListing(root).map((e) => (e.dir ? e.name + '/' : e.name)),
      tree: files.slice(0, 400).map((f) => f.rel),
      entrypoints: {
        html: files.filter((f) => f.rel.endsWith('.html')).map((f) => f.rel).slice(0, 25),
        scripts: files
          .filter((f) => /\.(ps1|sh)$/.test(f.rel))
          .map((f) => f.rel)
          .slice(0, 25),
        configs: files
          .filter((f) => /(^|\/)(package\.json|tsconfig[^/]*\.json|turbo\.json|Makefile|docker-compose\.ya?ml|Caddyfile|Dockerfile)$/.test(f.rel))
          .map((f) => f.rel)
          .slice(0, 25),
      },
      roots: {
        apps: countAnyDir(files, 'apps'),
        packages: countAnyDir(files, 'packages'),
        tests: countAnyDir(files, 'tests'),
        docs: countAnyDir(files, 'docs'),
        infra: countAnyDir(files, 'infra'),
        deploy: countAnyDir(files, 'deploy'),
      },
      subProducts,
      scripts: pkg?.scripts || null,
      declaredTargets: targetsDir ? dirListing(targetsDir).filter((d) => d.dir).length : null,
      declaredAdapters: adaptersDir ? dirListing(adaptersDir).filter((d) => d.dir).length : null,
      innerRoot: path.relative(outer, root).split(path.sep).join('/') || '.',
      digest: treeDigest(files),
      archive: spec.archive,
      archiveSha256: spec.archive ? sidecars[spec.archive] || null : null,
      archiveSha256Source: spec.archive && sidecars[spec.archive] ? 'supplied .sha256 sidecar' : null,
      hasReadme: Boolean(readme),
      hasPackageJson: Boolean(pkg),
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    totals: {
      projects: projects.length,
      files: projects.reduce((a, p) => a + p.fileCount, 0),
      bytes: projects.reduce((a, p) => a + p.bytes, 0),
      docs: projects.reduce((a, p) => a + p.docs.length, 0),
      html: projects.reduce((a, p) => a + p.entrypoints.html.length, 0),
    },
    sidecars: Object.entries(sidecars).map(([name, hash]) => ({ name, sha256: hash })),
    projects,
  };

  if (OUT) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  }
  return payload;
}

if (require.main === module) {
  const data = build();
  process.stdout.write(
    `scanned ${data.totals.projects} projects, ${data.totals.files} files, ` +
      `${(data.totals.bytes / 1048576).toFixed(2)} MB -> portal/data/builds.json\n`
  );
}

module.exports = { build };
