#!/usr/bin/env node
/**
 * Connects the private UE4 runtime-redistributable repository to this checkout.
 *
 * The Engine/ runtime tree (PhysX/APEX, Blast, NVIDIA SDKs, Ogg/Vorbis, XAudio2.9,
 * DbgHelp, UE4PrereqSetup) is licensed for redistribution only with a built game,
 * so it lives in the PRIVATE repo onegayunicorn/gameforge-ue4-redist and is never
 * committed here. This script fetches it into vendor/ue4-redist/ (git-ignored),
 * verifies every file against the SHA-256 list pinned in config/ue4-redist.sha256,
 * and stages Engine/ beside a packaged UE4 game's executable.
 *
 *   node scripts/ue4-redist.js fetch [--from <dir>] [--ref <branch|tag>]
 *   node scripts/ue4-redist.js verify
 *   node scripts/ue4-redist.js stage <gameDir> [--force]
 *
 * Environment: UE4_REDIST_REPO overrides the clone URL (e.g. an SSH URL).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEFAULT_REPO = 'https://github.com/onegayunicorn/gameforge-ue4-redist.git';
const MANIFEST = path.join(ROOT, 'config', 'ue4-redist.sha256');
const VENDOR_DIR = path.join(ROOT, 'vendor', 'ue4-redist');

/** Parse a `sha256sum` style list into [{ hash, rel }]. Rejects paths that escape Engine/. */
function readManifest(file = MANIFEST) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line.trim());
    if (!m) throw new Error(`Malformed manifest line: ${line}`);
    const rel = m[2].replace(/\\/g, '/');
    if (!rel.startsWith('Engine/') || rel.split('/').includes('..') || path.isAbsolute(rel)) {
      throw new Error(`Manifest path outside Engine/: ${rel}`);
    }
    return { hash: m[1], rel };
  });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Check dir/Engine against the manifest. Returns { ok, missing, mismatched, extra }. */
function verify(dir = VENDOR_DIR, manifest = readManifest()) {
  const missing = [];
  const mismatched = [];
  for (const { hash, rel } of manifest) {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) missing.push(rel);
    else if (sha256(file) !== hash) mismatched.push(rel);
  }
  const expected = new Set(manifest.map((e) => e.rel));
  const extra = listFiles(path.join(dir, 'Engine')).map((f) => 'Engine/' + f).filter((f) => !expected.has(f));
  return { ok: !missing.length && !mismatched.length, missing, mismatched, extra };
}

function listFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const rel = prefix ? `${prefix}/${d.name}` : d.name;
    return d.isDirectory() ? listFiles(path.join(dir, d.name), rel) : [rel];
  });
}

function git(args, opts = {}) {
  const r = spawnSync('git', args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} exited with ${r.status}`);
}

/** Populate vendor/ue4-redist from the private repo (default) or a local folder. */
function fetch({ from, ref, repo = process.env.UE4_REDIST_REPO || DEFAULT_REPO } = {}) {
  if (from) {
    const src = path.resolve(from);
    if (!fs.existsSync(path.join(src, 'Engine'))) throw new Error(`No Engine/ folder in ${src}`);
    fs.rmSync(VENDOR_DIR, { recursive: true, force: true });
    fs.mkdirSync(VENDOR_DIR, { recursive: true });
    fs.cpSync(path.join(src, 'Engine'), path.join(VENDOR_DIR, 'Engine'), { recursive: true });
  } else if (fs.existsSync(path.join(VENDOR_DIR, '.git'))) {
    git(['-C', VENDOR_DIR, 'fetch', '--depth', '1', 'origin', ref || 'HEAD']);
    git(['-C', VENDOR_DIR, 'checkout', '--force', 'FETCH_HEAD']);
  } else {
    fs.rmSync(VENDOR_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(VENDOR_DIR), { recursive: true });
    const args = ['clone', '--depth', '1'];
    if (ref) args.push('--branch', ref);
    git([...args, repo, VENDOR_DIR]);
  }
  return verify();
}

/** Copy Engine/ beside a packaged UE4 game's top-level .exe (the layout UE4 expects). */
function stage(gameDir, { force = false } = {}) {
  const target = path.resolve(gameDir);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw new Error(`Not a folder: ${target}`);
  const exes = fs.readdirSync(target).filter((f) => f.toLowerCase().endsWith('.exe'));
  if (!exes.length && !force) {
    throw new Error(`No .exe in ${target}. Point at the folder holding the game's launcher .exe, or pass --force.`);
  }
  const result = verify();
  if (!result.ok) throw new Error('vendor/ue4-redist failed verification; run `npm run ue4:fetch` first.');
  const manifest = readManifest();
  for (const { rel } of manifest) {
    const dest = path.join(target, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(VENDOR_DIR, rel), dest);
  }
  const staged = verify(target, manifest);
  if (!staged.ok) throw new Error('Staged copy failed verification.');
  return { target, exes, files: manifest.length };
}

function report(r) {
  for (const f of r.missing) console.error(`  missing:    ${f}`);
  for (const f of r.mismatched) console.error(`  mismatched: ${f}`);
  for (const f of r.extra) console.warn(`  unexpected: ${f}`);
  console.log(r.ok ? 'ue4-redist: all files verified.' : 'ue4-redist: verification FAILED.');
  return r.ok;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest.splice(i, 2)[1] : undefined;
  };
  try {
    if (cmd === 'fetch') return report(fetch({ from: flag('--from'), ref: flag('--ref') })) ? 0 : 1;
    if (cmd === 'verify') return report(verify()) ? 0 : 1;
    if (cmd === 'stage') {
      const force = rest.includes('--force');
      const dir = rest.find((a) => !a.startsWith('--'));
      if (!dir) throw new Error('Usage: ue4-redist stage <gameDir> [--force]');
      const r = stage(dir, { force });
      console.log(`ue4-redist: staged ${r.files} files into ${r.target}${r.exes.length ? ` (beside ${r.exes.join(', ')})` : ''}.`);
      return 0;
    }
    console.error('Usage: ue4-redist <fetch [--from dir] [--ref ref] | verify | stage <gameDir> [--force]>');
    return 2;
  } catch (err) {
    console.error(`ue4-redist: ${err.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { readManifest, verify, fetch, stage, main, VENDOR_DIR, MANIFEST, DEFAULT_REPO };
