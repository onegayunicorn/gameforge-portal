'use strict';
/**
 * Browser smoke test for a built game (run under Electron).
 *
 *   electron scripts/game-smoke.js <distDir> [outDir]
 *
 * Starts the same static server the portal uses, loads the built game and proves it is alive:
 * the runtime reaches "running", the engine reports entities, the canvas actually has pixels drawn
 * on it, and those pixels change between frames (i.e. the simulation is stepping and rendering).
 *
 * This is the acceptance check for milestone 1 - "renders a moving coloured square" - expressed as
 * an assertion rather than an eyeball.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { createPortalServer } = require('../electron/static-server');

const DIST = path.resolve(process.argv[2] || 'games/examples/hello-render/dist');
const OUT_DIR = path.resolve(process.argv[3] || path.join(DIST, '..', 'smoke'));
const problems = [];
const note = (message) => problems.push(message);

/** Sample the canvas: how many pixels differ from the clear colour, plus a cheap frame signature. */
const SAMPLE = `(() => {
  const canvas = document.getElementById('gameforge-canvas');
  if (!canvas) return { error: 'canvas missing' };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { error: 'no 2d context' };
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let painted = 0;
  let signature = 0;
  let brightest = { r: 0, g: 0, b: 0 };
  for (let i = 0; i < data.length; i += 4 * 37) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 24 || g > 30 || b > 48) painted += 1;
    if (r + g + b > brightest.r + brightest.g + brightest.b) brightest = { r, g, b };
    signature = (signature + r * 7 + g * 13 + b * 17) % 2147483647;
  }
  return { width, height, painted, signature, brightest };
})()`;

const STATE = `(() => {
  const status = document.getElementById('gameforge-status');
  const host = window.gameforgeHost;
  const errorPanel = document.querySelector('#gameforge-overlay .gf-error');
  // The panel is created up front and hidden; only a visible one is a failure.
  const overlayText = errorPanel && !errorPanel.hidden && errorPanel.offsetParent !== null
    ? errorPanel.textContent
    : null;
  const loadingVisible = Boolean(document.querySelector('#gameforge-overlay .gf-loading'));
  return {
    status: status ? status.dataset.state : null,
    statusText: status ? status.textContent : null,
    overlayError: overlayText,
    loadingVisible,
    runtimeState: host && host.engine ? host.engine.runtimeState() : null,
    assets: host && host.engine ? host.engine.assets.stats : null,
    layout: (() => {
      const footer = document.getElementById('gameforge-footer');
      const canvas = document.getElementById('gameforge-canvas');
      const footerRect = footer ? footer.getBoundingClientRect() : null;
      const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        footer: footerRect ? { top: Math.round(footerRect.top), bottom: Math.round(footerRect.bottom), height: Math.round(footerRect.height) } : null,
        canvas: canvasRect ? { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) } : null,
        documentScrollHeight: document.documentElement.scrollHeight,
        verticalOverflow: document.documentElement.scrollHeight > window.innerHeight + 2,
        footerClipped: footerRect ? footerRect.bottom > window.innerHeight + 1 : null,
      };
    })(),
  };
})()`;

app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    process.stderr.write(`No build at ${DIST} - run the build first\n`);
    app.exit(1);
    return;
  }

  const result = { dist: DIST, checks: {}, captures: {}, console: [], problems };
  const server = await createPortalServer({
    portalDir: DIST,
    runtimeInfo: () => ({ mode: 'game-smoke' }),
  });

  // Assets must all be reachable, otherwise a "working" game is a false positive.
  const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const referenced = Array.from(indexHtml.matchAll(/(?:src|href)="\.\/([^"]+)"/g)).map((match) => match[1]);
  result.checks.referenced = referenced;
  for (const file of referenced) {
    try {
      const response = await fetch(`${server.origin}/${file}`, { cache: 'no-store' });
      result.checks[file] = response.status;
      if (response.status !== 200) note(`referenced file not served: ${file} -> ${response.status}`);
    } catch (error) {
      result.checks[file] = `ERR ${error.message}`;
      note(`referenced file request failed: ${file}`);
    }
  }

  const manifestFile = path.join(DIST, 'manifest.json');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    for (const asset of manifest.assets) {
      const response = await fetch(`${server.origin}/${asset.source}`, { cache: 'no-store' });
      result.checks[`asset:${asset.id}`] = response.status;
      if (response.status !== 200) note(`manifest asset not served: ${asset.source} -> ${response.status}`);
    }
  }

  const win = new BrowserWindow({
    width: 1000,
    height: 640,
    show: false,
    backgroundColor: '#0b1020',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      // Electron throttles timers and rAF for hidden windows, which stalls the game loop and would
      // make this test pass or fail on window visibility rather than on the game's behaviour.
      backgroundThrottling: false,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    result.console.push({ level, message });
  });

  await win.loadURL(`${server.origin}/`);
  // Let the loop run: setup, a few hundred frames of simulation and rendering.
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const first = await win.webContents.executeJavaScript(SAMPLE);
  const firstState = await win.webContents.executeJavaScript(STATE);
  result.checks.firstFrame = first;
  result.checks.state = firstState;

  if (firstState.status !== 'running') note(`runtime status is "${firstState.status}" (expected running)`);
  if (firstState.overlayError) note(`runtime showed an error overlay: ${firstState.overlayError.slice(0, 300)}`);
  if (firstState.loadingVisible) note('loading overlay never went away');

  const layout = firstState.layout;
  result.checks.layout = layout;
  if (layout) {
    if (layout.verticalOverflow) note(`runtime shell overflows vertically (scrollHeight ${layout.documentScrollHeight} > viewport ${layout.viewport.height})`);
    if (layout.footerClipped) note(`footer is outside the viewport (bottom ${layout.footer && layout.footer.bottom} > ${layout.viewport.height})`);
    if (layout.canvas && layout.canvas.height < 100) note(`canvas collapsed to ${layout.canvas.height}px tall`);
  }
  if (!firstState.runtimeState) note('engine runtime state was not exposed on window.gameforgeHost');
  if (first.error) note(`canvas sampling failed: ${first.error}`);
  else if (first.painted === 0) note('canvas has no painted pixels - nothing was drawn');

  const state = firstState.runtimeState;
  if (state) {
    if (!(state.entities >= 3)) note(`expected several entities, engine reports ${state.entities}`);
    if (!(state.drawCalls > 0)) note(`expected draw calls, engine reports ${state.drawCalls}`);
    if (state.activeScene !== 'main') note(`expected active scene "main", got ${String(state.activeScene)}`);
    if (state.backend !== 'canvas2d') note(`expected canvas2d backend, got ${String(state.backend)}`);
    if (!(state.width === 960 && state.height === 540)) {
      note(`renderer viewport is ${state.width}x${state.height}, expected 960x540`);
    }
  }
  // The automatic scheduler must be live too (even if throttled, it must have ticked at least once).
  const loopRunning = await win.webContents.executeJavaScript('Boolean(window.gameforgeHost && window.gameforgeHost.engine && window.gameforgeHost.engine.isStarted)');
  result.checks.loopRunning = loopRunning;
  if (!loopRunning) note('engine reports it was never started');

  // Motion.
  //
  // Chromium throttles requestAnimationFrame to roughly 1 Hz for a hidden window, so a visible-time
  // wait cannot demonstrate animation reliably. The loop is therefore stepped explicitly through
  // its public API: each frame() runs a simulation step and a render, which is exactly what the
  // renderer would do on a visible page - minus the frame scheduling the window controls.
  const stepFrames = (count) => win.webContents.executeJavaScript(`(() => {
    const host = window.gameforgeHost;
    if (!host || !host.engine) return null;
    for (let i = 0; i < ${count}; i += 1) host.engine.loop.frame(1 / 60);
    return host.engine.runtimeState();
  })()`);

  await stepFrames(30);
  const second = await win.webContents.executeJavaScript(SAMPLE);
  result.checks.secondFrame = second;

  const stepped = await stepFrames(60);
  const third = await win.webContents.executeJavaScript(SAMPLE);
  result.checks.thirdFrame = third;
  result.checks.steppedState = stepped;

  if (!stepped) {
    note('engine loop could not be stepped through window.gameforgeHost.engine.loop');
  } else if (!(stepped.frames > 30)) {
    note(`stepping the loop did not advance the frame count (frames=${stepped.frames})`);
  }

  if (!first.error && !second.error && !third.error) {
    if (first.signature === second.signature && second.signature === third.signature) {
      note('canvas is identical across three sampled frames - the scene is not animating');
    }
    if (third.painted < 1) note('nothing painted after stepping 90 frames');
  }

  // The texture log proves the asset pipeline reached the renderer, not just the filesystem.
  const logText = result.console.map((entry) => entry.message).join('\n');
  result.checks.textureLoaded = /player texture ready \(\d+x\d+\)/.test(logText);
  if (!result.checks.textureLoaded) {
    note(`engine never logged a loaded player texture. console:\n${logText.slice(0, 600)}`);
  }

  // Only genuine failures count. Electron's dev-mode Security Warning and the canvas
  // "willReadFrequently" hint (provoked by this test reading pixels back) are not defects.
  const errorLines = result.console.filter((entry) => entry.level >= 2
    && !/Security Warning|Autofill|willReadFrequently/.test(entry.message));
  result.checks.consoleErrors = errorLines;
  if (errorLines.length > 0) note(`console errors: ${errorLines.map((entry) => entry.message).join(' | ').slice(0, 400)}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  result.captures.frame = path.join(OUT_DIR, 'hello-render.png');
  fs.writeFileSync(result.captures.frame, (await win.webContents.capturePage()).toPNG());

  await server.close();
  result.ok = problems.length === 0;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  win.destroy();
  app.exit(result.ok ? 0 : 1);
});
