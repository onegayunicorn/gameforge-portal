#!/usr/bin/env node
/**
 * Build every game project and write portal/data/games.json.
 *
 *   node scripts/generate-game-index.js            # build, then index
 *   node scripts/generate-game-index.js --no-build # index whatever is already built
 *
 * The index is a *measurement*: for each project it records what the pipeline found and what the
 * build produced (status, bundles, warnings, report path), so the portal can tell the difference
 * between "distribution-only scaffold", "buildable", "built", "failed" and "never built here".
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const OUTPUT = path.join(REPO_ROOT, 'portal', 'data', 'games.json');

const build = !process.argv.includes('--no-build');

/** Run the CLI's build command in a child process, so esbuild's state cannot leak into this one. */
function runBuildAll() {
  const cli = path.join(REPO_ROOT, 'tools', 'cli', 'gameforge.ts');
  const isWindows = process.platform === 'win32';
  const tsx = path.join(REPO_ROOT, 'node_modules', '.bin', isWindows ? 'tsx.cmd' : 'tsx');
  if (!fs.existsSync(tsx)) {
    process.stderr.write('tsx is not installed; run `npm install` first (or pass --no-build).\n');
    process.exit(1);
  }
  process.stdout.write('==> building all games\n');
  try {
    const output = execFileSync(tsx, [cli, 'build', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      // Node refuses to spawn a .cmd shim without a shell (EINVAL) on Windows.
      shell: isWindows,
    });
    return JSON.parse(output);
  } catch (error) {
    // The CLI exits non-zero when a build fails; its JSON report is still on stdout.
    const stdout = error.stdout ? String(error.stdout) : '';
    const start = stdout.indexOf('[');
    if (start >= 0) return JSON.parse(stdout.slice(start));
    process.stderr.write(`Build step failed: ${error.message}\n`);
    return [];
  }
}

function readJsonIfPresent(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function directorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += directorySize(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

/** Discover projects without importing the pipeline (keeps this script dependency-free). */
function discoverProjects() {
  const projects = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const configFile = path.join(dir, 'game.config.json');
    if (entries.some((entry) => entry.isFile() && entry.name === 'game.config.json')) {
      const config = readJsonIfPresent(configFile);
      if (config && config.id) {
        projects.push({
          root: dir,
          relativeRoot: path.relative(REPO_ROOT, dir).split(path.sep).join('/'),
          config,
          isTemplate: path.relative(path.join(GAMES_ROOT, 'templates'), dir).startsWith('..') === false,
        });
      }
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      walk(path.join(dir, entry.name));
    }
  };
  walk(GAMES_ROOT);
  return projects.sort((a, b) => a.config.id.localeCompare(b.config.id));
}

function main() {
  const reports = build ? runBuildAll() : [];
  const reportById = new Map(reports.map((report) => [report.gameId, report]));
  const projects = discoverProjects();

  const games = projects.map((project) => {
    const distDir = path.join(project.root, 'dist');
    const reportOnDisk = readJsonIfPresent(path.join(distDir, 'build-report.json'));
    const report = reportById.get(project.config.id) ?? reportOnDisk;
    const hasBuild = fs.existsSync(path.join(distDir, 'index.html'));
    const info = readJsonIfPresent(path.join(distDir, 'game.json'));
    const manifest = readJsonIfPresent(path.join(distDir, 'manifest.json'));

    // The readiness ladder the portal renders. Each rung is measured, never assumed.
    let state = 'discoverable';
    if (report && report.status === 'failed') state = 'failed';
    else if (hasBuild) state = 'runnable';
    else if (fs.existsSync(path.join(project.root, project.config.entry || ''))) state = 'buildable';

    return {
      id: project.config.id,
      name: project.config.name,
      version: project.config.version,
      description: project.config.description ?? '',
      engine: project.config.engine ?? '^0.1.0',
      entry: project.config.entry ?? null,
      tags: project.config.tags ?? [],
      projectDir: project.relativeRoot,
      isTemplate: project.isTemplate,
      width: project.config.width ?? 1280,
      height: project.config.height ?? 720,
      state,
      built: hasBuild,
      distDir: `${project.relativeRoot}/dist`,
      distBytes: hasBuild ? directorySize(distDir) : 0,
      assetCount: manifest && Array.isArray(manifest.assets) ? manifest.assets.length : 0,
      builtAt: info ? info.builtAt ?? null : null,
      bundles: report ? report.bundles ?? [] : [],
      outputs: report ? (report.outputs ?? []).length : 0,
      durationMs: report ? report.durationMs ?? null : null,
      errors: report ? (report.errors ?? []).map((issue) => ({ code: issue.code, message: issue.message })) : [],
      warnings: report ? (report.warnings ?? []).map((issue) => ({ code: issue.code, message: issue.message })) : [],
      reportPath: hasBuild ? `${project.relativeRoot}/dist/build-report.json` : null,
    };
  });

  const totals = {
    projects: games.length,
    built: games.filter((game) => game.built).length,
    failed: games.filter((game) => game.state === 'failed').length,
    assets: games.reduce((total, game) => total + game.assetCount, 0),
    outputBytes: games.reduce((total, game) => total + game.distBytes, 0),
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    engineVersion: readJsonIfPresent(path.join(REPO_ROOT, 'engine', 'package.json'))?.version ?? '0.1.0',
    gamesRoot: 'games',
    totals,
    games,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);

  process.stdout.write(
    `games index written: ${totals.projects} projects (${totals.built} built, ${totals.failed} failed), ` +
    `${totals.assets} assets, ${(totals.outputBytes / 1024).toFixed(1)} KB of build output\n`
  );
  for (const game of games) {
    process.stdout.write(`  ${game.state.padEnd(12)} ${game.id.padEnd(22)} ${game.distBytes ? `${(game.distBytes / 1024).toFixed(1)} KB` : ''}\n`);
  }
}

main();
