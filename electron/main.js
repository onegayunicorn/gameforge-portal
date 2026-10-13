'use strict';
/**
 * GameForge Portal - Electron main process.
 * Starts the embedded read-only portal server, opens the shell window, and exposes
 * a small validated IPC surface (reveal / open / export). Nothing is written without
 * an explicit user choice in a native dialog.
 */

const { app, BrowserWindow, Menu, ipcMain, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { createPortalServer } = require('./static-server');
const { build: scanBuilds } = require('../scripts/scan-builds');

const APP_ROOT = path.join(__dirname, '..');
const PORTAL_DIR = path.join(APP_ROOT, 'portal');

// The portal is served from loopback. Never let a system/OS proxy intercept it.
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox');

// In a packaged build the payload is unpacked into resources/ so the real files stay
// reachable on disk (reveal in Explorer, open in editor, copy out).
const RESOURCES_ROOT = app.isPackaged ? process.resourcesPath : APP_ROOT;
const PAYLOAD_DIR = path.join(RESOURCES_ROOT, 'payload');
const META_DIR = path.join(RESOURCES_ROOT, 'build-meta');

const startedAt = new Date().toISOString();
let portal = null;
let mainWindow = null;
let cachedScan = null;

/* ------------------------------------------------------------------ helpers */

function projectRoot(id, innerRoot) {
  const base = path.join(PAYLOAD_DIR, id);
  return innerRoot && innerRoot !== '.' ? path.join(base, innerRoot) : base;
}

function within(root, target) {
  const r = path.resolve(root);
  const t = path.resolve(target);
  return t === r || t.startsWith(r + path.sep);
}

function scan({ fresh = false } = {}) {
  if (!cachedScan || fresh) {
    cachedScan = scanBuilds({ payloadDir: PAYLOAD_DIR, metaDir: META_DIR, outPath: null });
  }
  return cachedScan;
}

function findById(id) {
  return scan().projects.find((p) => p.id === id) || null;
}

/** Resolve a project-relative file, falling back to a recursive name search. */
function resolveProjectFile(id, rel) {
  const project = findById(id);
  if (!project) return null;
  const root = projectRoot(id, project.innerRoot);

  if (rel) {
    const direct = path.resolve(root, rel);
    if (within(root, direct) && fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  }

  const wanted = (rel || 'README.md').split('/').pop().toLowerCase();
  const queue = [root];
  const hits = [];
  while (queue.length && hits.length < 5) {
    const dir = queue.shift();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) queue.push(full);
      else if (e.name.toLowerCase() === wanted) hits.push(full);
    }
  }
  if (!hits.length) return null;
  // Prefer the shallowest match so a project README wins over nested package readmes.
  hits.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  return hits[0];
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyTree(from, to);
    else if (entry.isFile()) { fs.copyFileSync(from, to); count += 1; }
  }
  return count;
}

function runtimeInfo() {
  const cpus = os.cpus();
  return {
    mode: 'desktop',
    productName: 'GameForge Portal',
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
    isPackaged: app.isPackaged,
    platform: `${os.type()} ${os.release()}`,
    arch: process.arch,
    cpus: cpus.length,
    cpuModel: cpus[0] ? cpus[0].model : undefined,
    totalMem: os.totalmem(),
    locale: Intl.DateTimeFormat().resolvedOptions().locale + ' / ' + Intl.DateTimeFormat().resolvedOptions().timeZone,
    startedAt,
    serverHost: portal ? portal.host : undefined,
    serverPort: portal ? portal.port : undefined,
    portalUrl: portal ? portal.origin : undefined,
    payloadPath: PAYLOAD_DIR,
    portalDir: PORTAL_DIR,
  };
}

/* ------------------------------------------------------------------ IPC */

function registerIpc() {
  ipcMain.handle('app:info', () => runtimeInfo());

  ipcMain.handle('payload:recheck', () => ({ ok: true, data: scan({ fresh: true }) }));

  ipcMain.handle('payload:reveal', async () => {
    if (!fs.existsSync(PAYLOAD_DIR)) return { ok: false, error: `Payload directory missing: ${PAYLOAD_DIR}` };
    const err = await shell.openPath(PAYLOAD_DIR);
    return err ? { ok: false, error: err } : { ok: true, detail: PAYLOAD_DIR };
  });

  ipcMain.handle('project:reveal', async (_e, { id } = {}) => {
    const project = findById(id);
    if (!project) return { ok: false, error: `Unknown project: ${id}` };
    const target = projectRoot(id, project.innerRoot);
    if (!fs.existsSync(target)) return { ok: false, error: `Missing folder: ${target}` };
    shell.showItemInFolder(path.join(target, 'package.json'));
    const err = await shell.openPath(target);
    return err ? { ok: false, error: err } : { ok: true, detail: target };
  });

  ipcMain.handle('project:openFile', async (_e, { id, rel } = {}) => {
    const file = resolveProjectFile(id, rel);
    if (!file) return { ok: false, error: `File not found in project "${id}": ${rel}` };
    const err = await shell.openPath(file);
    return err ? { ok: false, error: err } : { ok: true, detail: path.relative(PAYLOAD_DIR, file) };
  });

  ipcMain.handle('project:copyPath', (_e, { id } = {}) => {
    const project = findById(id);
    if (!project) return { ok: false, error: `Unknown project: ${id}` };
    const target = projectRoot(id, project.innerRoot);
    clipboard.writeText(target);
    return { ok: true, detail: target };
  });

  ipcMain.handle('project:export', async (_e, { id } = {}) => {
    const project = findById(id);
    if (!project) return { ok: false, error: `Unknown project: ${id}` };
    const source = projectRoot(id, project.innerRoot);

    const picked = await dialog.showOpenDialog(mainWindow, {
      title: `Export "${project.label}" to a folder`,
      buttonLabel: 'Export here',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (picked.canceled || !picked.filePaths.length) return { ok: false, error: 'Cancelled' };

    const dest = path.join(picked.filePaths[0], project.id);
    try {
      if (fs.existsSync(dest)) {
        return { ok: false, error: `Destination already exists: ${dest}` };
      }
      const count = copyTree(source, dest);
      return { ok: true, detail: `${count} files written to ${dest}` };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  });

  ipcMain.handle('portal:openExternal', async (_e, { url } = {}) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { ok: false, error: 'Only http(s) URLs are allowed' };
    await shell.openExternal(url);
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ window */

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Reveal payload folder', click: () => shell.openPath(PAYLOAD_DIR) },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open portal in browser',
          click: () => { if (portal) shell.openExternal(portal.origin); },
        },
        {
          label: 'About GameForge Portal',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About GameForge Portal',
            message: `GameForge Portal ${app.getVersion()}`,
            detail:
              `Desktop launcher and website portal for the embedded game-platform builds.\n\n` +
              `Payload: ${PAYLOAD_DIR}\n` +
              `Portal server: ${portal ? portal.origin : 'n/a'}\n` +
              `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}`,
            buttons: ['Close'],
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#070a12',
    show: false,
    autoHideMenuBar: false,
    title: 'GameForge Portal',
    icon: path.join(APP_ROOT, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  // Keep navigation inside the local portal; send anything else to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (portal && url.startsWith(portal.origin)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  mainWindow.loadURL(portal.origin);
}

/* ------------------------------------------------------------------ self test */

/**
 * `--selftest <outDir>` renders the portal offscreen at desktop and mobile widths and
 * writes PNG captures, then exits. Used to verify the UI without a visible window.
 */
async function runSelfTest(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const viewports = [
    { name: 'desktop', width: 1440, height: 940 },
    { name: 'mobile', width: 390, height: 844 },
    {
      name: 'drawer',
      width: 1440,
      height: 940,
      act: `document.querySelector('#projectGrid .card [data-act="detail"]').click()`,
      scrollTo: 1100,
    },
  ];
  const results = [];
  const windows = [];
  for (const vp of viewports) {
    const win = new BrowserWindow({
      width: vp.width,
      height: vp.height,
      show: false,
      backgroundColor: '#070a12',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      process.stderr.write(`did-fail-load viewport=${vp.name} code=${code} desc=${desc} url=${url}\n`);
    });
    win.webContents.on('console-message', (_e, level, message, line, source) => {
      process.stderr.write(`console[${level}] ${source}:${line} ${message}\n`);
    });
    process.stderr.write(`loading ${portal.origin}/ (viewport ${vp.name})\n`);
    await win.loadURL(portal.origin + '/');
    await new Promise((r) => setTimeout(r, 1200));
    if (vp.act) {
      await win.webContents.executeJavaScript(vp.act);
      await new Promise((r) => setTimeout(r, 500));
    }
    if (vp.scrollTo) {
      await win.webContents.executeJavaScript(`window.scrollTo(0, ${vp.scrollTo})`);
      await new Promise((r) => setTimeout(r, 400));
    }
    const probe = await win.webContents.executeJavaScript(`(() => {
      const cards = document.querySelectorAll('#projectGrid .card').length;
      const stats = document.querySelectorAll('#statGrid li .stat-value').length;
      const docs = document.querySelectorAll('#docColumns button').length;
      const rows = document.querySelectorAll('#integrityTable tbody tr').length;
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
      const wide = overflow ? Array.from(document.querySelectorAll('body *'))
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2)
        .slice(0, 8)
        .map((el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : '') + ' @' + Math.round(el.getBoundingClientRect().right))) : [];
      const nav = document.querySelector('.topbar-inner') !== null;
      const mode = document.getElementById('modeText').textContent;
      const bridge = Boolean(window.portalAPI && window.portalAPI.isDesktop);
      const drawer = document.getElementById('drawer');
      const drawerOpen = drawer ? !drawer.hasAttribute('hidden') : false;
      const drawerTitle = drawerOpen ? document.getElementById('drawerTitle').textContent : null;
      const drawerTabs = drawer ? drawer.querySelectorAll('.tab').length : 0;
      const drawerBodyChars = drawerOpen ? document.getElementById('drawerBody').textContent.trim().length : 0;
      return { title: document.title, cards, stats, docs, rows, overflow, wide, nav, mode, bridge,
               drawerOpen, drawerTitle, drawerTabs, drawerBodyChars,
               errors: window.__portalErrors || [] };
    })()`);
    const img = await win.webContents.capturePage();
    const file = path.join(outDir, `portal-${vp.name}.png`);
    fs.writeFileSync(file, img.toPNG());
    results.push({ viewport: `${vp.width}x${vp.height}`, file, ...probe });
    windows.push(win);
  }
  // Destroy only after every capture so 'window-all-closed' cannot abort the run.
  for (const win of windows) win.destroy();
  process.stdout.write(JSON.stringify({ ok: true, origin: portal.origin, captures: results }, null, 2) + '\n');
}

/* ------------------------------------------------------------------ boot */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      portal = await createPortalServer({ portalDir: PORTAL_DIR, runtimeInfo });
    } catch (err) {
      dialog.showErrorBox('Portal server failed to start', String(err && err.message || err));
      app.quit();
      return;
    }

    registerIpc();

    const selfTestIdx = process.argv.indexOf('--selftest');
    if (selfTestIdx !== -1) {
      const outDir = process.argv[selfTestIdx + 1] || path.join(APP_ROOT, 'selftest');
      try {
        await runSelfTest(outDir);
        app.exit(0);
      } catch (err) {
        process.stderr.write(`selftest failed: ${err && err.stack || err}\n`);
        app.exit(1);
      }
      return;
    }

    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', async () => {
    if (portal) { try { await portal.close(); } catch { /* ignore */ } }
    if (process.platform !== 'darwin') app.quit();
  });
}
