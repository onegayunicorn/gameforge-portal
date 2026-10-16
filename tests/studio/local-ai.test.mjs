import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { validateStudioPayload, starterScene } = require(path.join(ROOT, 'portal/studio/validation.js'));
const modelCatalog = JSON.parse(await readFile(path.join(ROOT, 'portal/studio/models.json'), 'utf8'));
const webllmPackage = JSON.parse(await readFile(path.join(ROOT, 'node_modules/@mlc-ai/web-llm/package.json'), 'utf8'));
const webllmRegistry = await readFile(path.join(ROOT, 'node_modules/@mlc-ai/web-llm/lib/index.js'), 'utf8');

test('all shipped starter simulations pass the bounded output validator', () => {
  for (const kind of ['rope', 'bouncer', 'platform']) {
    const result = validateStudioPayload(starterScene(kind));
    assert.equal(result.ok, true, `${kind}: ${result.errors.join('; ')}`);
  }
});

test('local model catalog uses pinned WebLLM models and requires no API key', () => {
  assert.equal(modelCatalog.runtime, '@mlc-ai/web-llm');
  assert.equal(modelCatalog.runtimeVersion, '0.2.86');
  assert.equal(webllmPackage.version, modelCatalog.runtimeVersion);
  assert.equal(webllmPackage.license, 'Apache-2.0');
  assert.equal(modelCatalog.apiKeyRequired, false);
  assert.deepEqual(modelCatalog.models.map((model) => model.id), [
    'gemma3-1b-it-q4f16_1-MLC',
    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    'Qwen3-0.6B-q4f16_1-MLC',
  ]);
  for (const model of modelCatalog.models) assert.ok(webllmRegistry.includes(model.id), `${model.id} is absent from the installed WebLLM registry`);
});

test('validator rejects unsafe or structurally unsupported simulation output', () => {
  const invalid = starterScene('rope');
  invalid.sim.entities[0].x = Number.NaN;
  assert.equal(validateStudioPayload(invalid).ok, false);

  const tooMany = starterScene('bouncer');
  tooMany.sim.entities = Array.from({ length: 33 }, () => tooMany.sim.entities[0]);
  assert.equal(validateStudioPayload(tooMany).ok, false);

  const badColor = starterScene('platform');
  badColor.sim.world.background = 'url(https://example.invalid)';
  assert.equal(validateStudioPayload(badColor).ok, false);
});

test('Studio route and CSP expose only the model artifact hosts, not arbitrary script execution', async () => {
  const [routesText, htmlText, workerText, swText] = await Promise.all([
    readFile(path.join(ROOT, 'portal/manus-routes.json'), 'utf8'),
    readFile(path.join(ROOT, 'portal/studio/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'portal/studio/ai-worker.js'), 'utf8'),
    readFile(path.join(ROOT, 'pwa-src/sw.js'), 'utf8'),
  ]);
  assert.match(routesText, /"path"\s*:\s*"\/studio\/"/);
  assert.match(htmlText, /https:\/\/raw\.githubusercontent\.com/);
  assert.match(htmlText, /https:\/\/\*\.huggingface\.co/);
  assert.match(htmlText, /worker-src 'self'/);
  assert.doesNotMatch(workerText, /fetch\s*\(/);
  assert.match(swText, /startsWith\('gameforge-pwa-'/);
});
