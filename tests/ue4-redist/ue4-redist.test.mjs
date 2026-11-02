// Runs without the private redistributables: checks the pinned manifest and the verifier logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readManifest, verify } = require('../../scripts/ue4-redist.js');

test('pinned manifest lists the 21 Engine/ files', () => {
  const m = readManifest();
  assert.equal(m.length, 21);
  assert.ok(m.every((e) => e.rel.startsWith('Engine/') && /^[0-9a-f]{64}$/.test(e.hash)));
  assert.ok(m.some((e) => e.rel.endsWith('UE4PrereqSetup_x64.exe')));
});

test('manifest rejects paths that escape Engine/', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue4m-'));
  const file = path.join(dir, 'm.sha256');
  fs.writeFileSync(file, `${'0'.repeat(64)}  Engine/../evil.dll\n`);
  assert.throws(() => readManifest(file), /outside Engine/);
});

test('verify reports missing, mismatched and extra files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue4v-'));
  fs.mkdirSync(path.join(dir, 'Engine', 'Bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Engine/Bin/a.dll'), 'good');
  fs.writeFileSync(path.join(dir, 'Engine/Bin/b.dll'), 'tampered');
  fs.writeFileSync(path.join(dir, 'Engine/Bin/x.dll'), 'extra');
  const h = (s) => crypto.createHash('sha256').update(s).digest('hex');
  const manifest = [
    { hash: h('good'), rel: 'Engine/Bin/a.dll' },
    { hash: h('original'), rel: 'Engine/Bin/b.dll' },
    { hash: h('c'), rel: 'Engine/Bin/c.dll' },
  ];
  const r = verify(dir, manifest);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['Engine/Bin/c.dll']);
  assert.deepEqual(r.mismatched, ['Engine/Bin/b.dll']);
  assert.deepEqual(r.extra, ['Engine/Bin/x.dll']);
  assert.equal(verify(dir, manifest.slice(0, 1)).ok, true);
});
