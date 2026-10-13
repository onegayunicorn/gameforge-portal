'use strict';
/**
 * Game build/preview/inspect actions for the desktop shell.
 *
 * Security posture (matching the portal's existing model):
 *  - the renderer may only name a game id that already exists in portal/data/games.json
 *  - every path handed to the shell is resolved from that entry and checked to be inside the root
 *  - the renderer can never pass a command, an argument or a path of its own choosing
 *  - builds run in a child process, so a runaway build cannot take the shell down with it
 *
 * Builds are executed by the bundled CLI (build/gameforge-cli.cjs) under Electron's own Node, which
 * is why the pipeline is bundled rather than imported: the pipeline is TypeScript and esbuild must
 * not be loaded into the renderer/main isolate.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { BrowserWindow, ipcMain, shell } = require('electron');

const INDEX_FILE = path.join('portal', 'data', 'games.json');
const CLI_BUNDLE = path.join('build', 'gameforge-cli.cjs');
const BUILD_TIMEOUT_MS = 5 * 60 * 1000;

/** Preview windows, keyed by game id, so Stop can close the right one. */
const previewWindows = new Map();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Pull the JSON payload out of a CLI run.
 *
 * The CLI prints either a single report object (one project) or an array (all projects), possibly
 * after a progress line, so the widest span between the first opening and last closing bracket is
 * taken. Looking only for `[...]` was the original mistake: it matched the report's own `outputs`
 * array and parsed a fragment.
 */
function extractJson(text) {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);
  if (start < 0) return null;

  const end = text.lastIndexOf(text[start] === '{' ? '}' : ']');
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function within(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * @param {object} options
 * @param {string} options.repoRoot Absolute path to the source tree (or the shipped equivalent).
 * @param {() => BrowserWindow|null} options.getPortalWindow Window to forward runtime state to.
 * @param {(message: string) => void} [options.log]
 */
function registerGameActions({ repoRoot, getPortalWindow, log = () => {} }) {
  const gameIndex = () => readJson(path.join(repoRoot, INDEX_FILE));
  const cliPath = path.join(repoRoot, CLI_BUNDLE);

  /** Resolve an id from the index into validated absolute paths. Throws on anything unexpected. */
  function resolveGame(id) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 64 || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      throw new Error(`Invalid game id: ${String(id)}`);
    }
    const index = gameIndex();
    if (!index || !Array.isArray(index.games)) {
      throw new Error('The game index is missing. Run the games index step first.');
    }
    const entry = index.games.find((game) => game.id === id);
    if (!entry) throw new Error(`Unknown game "${id}" - it is not in the game index.`);

    const projectDir = path.resolve(repoRoot, entry.projectDir);
    const distDir = path.resolve(repoRoot, entry.distDir);
    if (!within(repoRoot, projectDir)) throw new Error(`Refusing a project path outside the root: ${projectDir}`);
    if (!within(repoRoot, distDir)) throw new Error(`Refusing a build path outside the root: ${distDir}`);
    return { entry, projectDir, distDir };
  }

  /**
   * Run the bundled CLI and return its parsed JSON output.
   *
   * ELECTRON_RUN_AS_NODE makes the Electron binary behave as plain Node for the child, so no system
   * Node installation is assumed.
   */
  function runCli(args, { timeoutMs = BUILD_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(cliPath)) {
        reject(new Error(`The pipeline is not bundled in this build (${CLI_BUNDLE}). Run: npm run cli:bundle`));
        return;
      }

      const child = spawn(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', GAMEFORGE_ROOT: repoRoot },
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${Math.round(timeoutMs / 1000)}s: ${args.join(' ')}`));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, data: extractJson(stdout), stdout, stderr });
      });
    });
  }

  /** Open a game's build output in its own window, served from the build folder. */
  async function openPreview(id, distDir) {
    const existing = previewWindows.get(id);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { ok: true, message: 'The game window is already open.' };
    }

    const { createPortalServer } = require('./static-server');
    const server = await createPortalServer({ portalDir: distDir, runtimeInfo: () => ({ mode: 'game-preview', gameId: id }) });
    const win = new BrowserWindow({
      width: 1024,
      height: 720,
      backgroundColor: '#0b1020',
      title: `GameForge - ${id}`,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        sandbox: true,
      },
    });

    previewWindows.set(id, win);
    win.on('closed', () => {
      previewWindows.delete(id);
      void server.close();
    });

    await win.loadURL(`${server.origin}/`);
    return { ok: true, message: `Serving ${path.relative(repoRoot, distDir)} on ${server.origin}` };
  }

  /* ------------------------------------------------------------------ handlers */

  ipcMain.handle('game:build', async (_event, { id } = {}) => {
    try {
      const { entry, projectDir } = resolveGame(id);
      const result = await runCli(['build', entry.projectDir, '--json', '--minify']);
      const report = result.data && !Array.isArray(result.data) ? result.data : (result.data || [])[0];
      if (!report) {
        return { ok: false, message: `The build produced no report.\n${(result.stderr || result.stdout).slice(0, 400)}` };
      }
      log(`build ${projectDir} -> ${report.status}`);
      return { ok: report.status === 'success', report };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle('game:validate', async (_event, { id } = {}) => {
    try {
      const { entry } = resolveGame(id);
      const result = await runCli(['validate', entry.projectDir, '--json'], { timeoutMs: 60_000 });
      const results = Array.isArray(result.data) ? result.data : [];
      const first = results[0];
      if (!first) return { ok: false, valid: false, message: (result.stderr || 'No validation output.').slice(0, 400) };
      const message = [
        ...first.errors.map((issue) => `error ${issue.code}: ${issue.message}`),
        ...first.warnings.map((issue) => `warn ${issue.code}: ${issue.message}`),
      ].slice(0, 4).join('; ');
      return { ok: true, valid: first.valid, message: message || 'No problems found.' };
    } catch (error) {
      return { ok: false, valid: false, message: error.message };
    }
  });

  ipcMain.handle('game:preview', async (_event, { id } = {}) => {
    try {
      const { entry, distDir } = resolveGame(id);
      if (!fs.existsSync(path.join(distDir, 'index.html'))) {
        return { ok: false, message: `${entry.id} has no build yet - build it first.` };
      }
      return await openPreview(id, distDir);
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle('game:stop', async (_event, { id } = {}) => {
    try {
      const win = previewWindows.get(id);
      if (!win) return { ok: false, message: 'That game is not running.' };
      win.close();
      return { ok: true, message: 'Game window closed.' };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle('game:logs', async (_event, { id } = {}) => {
    try {
      const { distDir } = resolveGame(id);
      const report = readJson(path.join(distDir, 'build-report.json'));
      if (!report) return { ok: false, lines: ['No build report found - build the game first.'] };

      const lines = [
        `${report.gameId} v${report.version} - ${report.status}`,
        `started   ${report.startedAt}`,
        `finished  ${report.finishedAt} (${report.durationMs} ms)`,
        `entry     ${report.entry}`,
        `output    ${report.outputs.length} files, ${(report.outputBytes / 1024).toFixed(1)} KB`,
        `assets    ${report.assetCount} files, ${(report.totalAssetBytes / 1024).toFixed(1)} KB`,
        '',
        'bundles',
        ...report.bundles.map((bundle) => `  ${bundle.file.padEnd(26)} ${(bundle.bytes / 1024).toFixed(1)} KB`),
        '',
        'outputs',
        ...report.outputs.map((output) => `  ${output.kind.padEnd(9)} ${output.file.padEnd(30)} ${output.bytes} B`),
      ];
      if (report.warnings.length > 0) {
        lines.push('', 'warnings', ...report.warnings.map((issue) => `  ${issue.code}: ${issue.message}`));
      }
      if (report.errors.length > 0) {
        lines.push('', 'errors', ...report.errors.map((issue) => `  ${issue.code}: ${issue.message}`));
      }
      return { ok: true, lines };
    } catch (error) {
      return { ok: false, lines: [error.message] };
    }
  });

  ipcMain.handle('game:source', async (_event, { id } = {}) => {
    try {
      const { projectDir } = resolveGame(id);
      const error = await shell.openPath(projectDir);
      return error ? { ok: false, message: error } : { ok: true, message: `Opened ${path.relative(repoRoot, projectDir)}` };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle('game:buildFolder', async (_event, { id } = {}) => {
    try {
      const { distDir } = resolveGame(id);
      if (!fs.existsSync(distDir)) return { ok: false, message: 'Nothing built yet.' };
      const error = await shell.openPath(distDir);
      return error ? { ok: false, message: error } : { ok: true, message: `Opened ${path.relative(repoRoot, distDir)}` };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  /**
   * Runtime state reported by a game window's engine (see the `gameforge` bridge in preload.js).
   * Forwarded to the portal so a running game can be inspected from its card.
   */
  ipcMain.on('gameforge:runtime', (event, state) => {
    const senderId = BrowserWindow.fromWebContents(event.sender);
    const id = [...previewWindows.entries()].find(([, win]) => win === senderId)?.[0];
    const portalWindow = getPortalWindow();
    if (!id || !portalWindow || portalWindow.isDestroyed()) return;
    portalWindow.webContents.send('game:runtime', { id, state });
  });

  ipcMain.on('gameforge:log', (event, entry) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    const id = [...previewWindows.entries()].find(([, win]) => win === sender)?.[0];
    if (id) log(`[game ${id}] ${entry && entry.level}: ${entry && entry.message}`);
  });

  return { resolveGame, runCli, closeAll: () => previewWindows.forEach((win) => win.close()) };
}

module.exports = { registerGameActions };
