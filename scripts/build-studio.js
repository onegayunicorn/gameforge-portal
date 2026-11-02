'use strict';

const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const ENTRY = path.join(ROOT, 'portal', 'studio', 'ai-worker.js');
const OUT = path.join(ROOT, 'portal', 'studio', 'ai-worker.bundle.js');

async function build() {
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    outfile: OUT,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: ['chrome121'],
    conditions: ['browser', 'import'],
    mainFields: ['browser', 'module', 'main'],
    minify: true,
    legalComments: 'inline',
    sourcemap: false,
    logLevel: 'silent',
  });
  if (result.errors.length) throw new Error('WebLLM worker bundle failed.');
  const webllmRoot = path.join(ROOT, 'node_modules', '@mlc-ai', 'web-llm');
  const loglevelRoot = path.join(ROOT, 'node_modules', 'loglevel');
  const webllmPackage = JSON.parse(fs.readFileSync(path.join(webllmRoot, 'package.json'), 'utf8'));
  const loglevelPackage = JSON.parse(fs.readFileSync(path.join(loglevelRoot, 'package.json'), 'utf8'));
  const notices = [
    'Third-party notices for the GameForge Local AI Studio bundle',
    '',
    `@mlc-ai/web-llm ${webllmPackage.version} (${webllmPackage.license})`,
    fs.readFileSync(path.join(webllmRoot, 'LICENSE'), 'utf8'),
    `loglevel ${loglevelPackage.version} (${loglevelPackage.license})`,
    fs.readFileSync(path.join(loglevelRoot, 'LICENSE-MIT'), 'utf8'),
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'portal', 'studio', 'THIRD-PARTY-LICENSES.txt'), notices);
  const bytes = fs.statSync(OUT).size;
  process.stdout.write(`Studio worker built: ${(bytes / 1024 / 1024).toFixed(2)} MiB (${path.relative(ROOT, OUT)})\n`);
}

if (require.main === module) {
  build().catch((error) => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = { build, ENTRY, OUT };
