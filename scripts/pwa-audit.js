'use strict';
/**
 * PWA audit (run under Electron): verifies the installable-app requirements against the real
 * built files, then proves offline behaviour by shutting the server down and reloading.
 *
 *   electron scripts/pwa-audit.js <outDir>
 *
 * Checks: manifest link + parsed fields, every declared icon and screenshot over HTTP,
 * service-worker registration/activation/control, precache contents, tab bar, install UI,
 * layout overflow, console errors - then a hard offline reload served purely from the cache.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { createPortalServer } = require('../electron/static-server');

const ROOT = path.join(__dirname, '..');
const PWA_DIR = path.join(ROOT, 'pwa');
const OUT_DIR = process.argv[2] || path.join(ROOT, 'selftest-pwa');

const consoleErrors = [];
const problems = [];
const note = (msg) => problems.push(msg);

async function fetchStatus(base, rel) {
  try {
    const res = await fetch(new URL(rel, base).href, { cache: 'no-store' });
    return res.status;
  } catch (err) {
    return `ERR ${(err && err.message) || err}`;
  }
}

async function probe(win) {
  return win.webContents.executeJavaScript(`(async () => {
    const pwa = window.__pwaState || {};
    const manifestLink = document.querySelector('link[rel="manifest"]');
    let manifest = null, manifestError = null;
    try {
      const res = await fetch(manifestLink ? manifestLink.href : './manifest.webmanifest', { cache: 'no-store' });
      manifest = await res.json();
    } catch (e) { manifestError = String(e && e.message || e); }

    let reg = null, cacheNames = [], cachedCount = 0;
    try { reg = await navigator.serviceWorker.getRegistration(); } catch {}
    try {
      cacheNames = await caches.keys();
      if (cacheNames.length) {
        const c = await caches.open(cacheNames[0]);
        cachedCount = (await c.keys()).length;
      }
    } catch {}

    const wide = Array.from(document.querySelectorAll('body *'))
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2)
      .slice(0, 6)
      .map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));

    return {
      title: document.title,
      manifestPresent: Boolean(manifestLink),
      manifestHref: manifestLink ? manifestLink.getAttribute('href') : null,
      manifestError,
      manifest: manifest && {
        name: manifest.name,
        short_name: manifest.short_name,
        display: manifest.display,
        start_url: manifest.start_url,
        scope: manifest.scope,
        theme_color: manifest.theme_color,
        background_color: manifest.background_color,
        icons: (manifest.icons || []).map((i) => i.sizes + ' ' + i.purpose),
        screenshots: (manifest.screenshots || []).length,
        shortcuts: (manifest.shortcuts || []).length,
      },
      appleTouchIcon: Boolean(document.querySelector('link[rel="apple-touch-icon"]')),
      standaloneMeta: Boolean(document.querySelector('meta[name="apple-mobile-web-app-capable"]')),
      viewport: (document.querySelector('meta[name="viewport"]') || {}).content || null,
      swSupported: 'serviceWorker' in navigator,
      swRegistered: Boolean(pwa.swRegistered),
      swActive: Boolean(pwa.swActive),
      swController: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      swScope: pwa.swScope || null,
      swError: pwa.swError || null,
      regActive: Boolean(reg && reg.active),
      cacheNames,
      cachedCount,
      tabbar: Boolean(document.getElementById('pwaTabbar')),
      tabLinks: document.querySelectorAll('#pwaTabbar a[data-tab]').length,
      installCard: (() => {
        const c = document.getElementById('installCard');
        return c ? { state: c.dataset.state, title: (document.getElementById('installTitle') || {}).textContent, buttonVisible: !(document.getElementById('btnInstall') || {}).hidden } : null;
      })(),
      standalone: Boolean(pwa.standalone),
      cards: document.querySelectorAll('#projectGrid .card').length,
      docs: document.querySelectorAll('#docColumns button').length,
      rows: document.querySelectorAll('#integrityTable tbody tr').length,
      stats: document.querySelectorAll('#statGrid li .stat-value').length,
      firstProject: (document.querySelector('#projectGrid .card h3') || {}).textContent || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      wide,
      errors: window.__portalErrors || [],
    };
  })()`);
}

async function waitForServiceWorker(win, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await win.webContents.executeJavaScript(
      'Boolean(window.__pwaState && window.__pwaState.swActive && navigator.serviceWorker.controller)'
    );
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!fs.existsSync(path.join(PWA_DIR, 'index.html'))) {
    process.stderr.write('pwa/index.html missing - run: node scripts/build-pwa.js\n');
    app.exit(1);
    return;
  }

  const server = await createPortalServer({
    portalDir: PWA_DIR,
    runtimeInfo: () => ({ mode: 'pwa-static', productName: 'GameForge Portal' }),
  });

  const win = new BrowserWindow({
    width: 390, height: 844, show: false, backgroundColor: '#070a12',
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2 && !/Security Warning/.test(message)) {
      consoleErrors.push(message);
      process.stderr.write(`console: ${message}\n`);
    }
  });

  const result = { origin: server.origin, checks: {}, captures: {}, offline: {}, problems };

  // ---- asset availability over HTTP -------------------------------------------------
  const manifest = JSON.parse(fs.readFileSync(path.join(PWA_DIR, 'manifest.webmanifest'), 'utf8'));
  const assetChecks = {
    '/': await fetchStatus(server.origin, '/'),
    '/manifest.webmanifest': await fetchStatus(server.origin, '/manifest.webmanifest'),
    '/sw.js': await fetchStatus(server.origin, '/sw.js'),
    '/pwa.css': await fetchStatus(server.origin, '/pwa.css'),
    '/pwa.js': await fetchStatus(server.origin, '/pwa.js'),
    '/offline.html': await fetchStatus(server.origin, '/offline.html'),
    '/data/builds.json': await fetchStatus(server.origin, '/data/builds.json'),
    '/studio/': await fetchStatus(server.origin, '/studio/'),
    '/studio/models.json': await fetchStatus(server.origin, '/studio/models.json'),
    '/studio/local-inference.html': await fetchStatus(server.origin, '/studio/local-inference.html'),
    '/studio/THIRD-PARTY-LICENSES.txt': await fetchStatus(server.origin, '/studio/THIRD-PARTY-LICENSES.txt'),
  };
  for (const icon of manifest.icons) assetChecks[icon.src] = await fetchStatus(server.origin, icon.src);
  for (const shot of manifest.screenshots || []) assetChecks[shot.src] = await fetchStatus(server.origin, shot.src);
  result.checks.assets = assetChecks;
  for (const [url, status] of Object.entries(assetChecks)) {
    if (status !== 200) note(`asset not served with 200: ${url} -> ${status}`);
  }

  // ---- mobile viewport --------------------------------------------------------------
  await win.loadURL(server.origin + '/');
  await new Promise((r) => setTimeout(r, 1400));
  const swReady = await waitForServiceWorker(win);
  if (!swReady) note('service worker did not reach an active, controlling state');
  await new Promise((r) => setTimeout(r, 400));

  const mobile = await probe(win);
  result.checks.mobile = mobile;
  result.captures.mobileTop = path.join(OUT_DIR, 'pwa-mobile-top.png');
  fs.writeFileSync(result.captures.mobileTop, (await win.webContents.capturePage()).toPNG());

  if (!mobile.manifestPresent) note('no <link rel="manifest"> in the page');
  if (mobile.manifestError) note(`manifest could not be parsed: ${mobile.manifestError}`);
  if (mobile.manifest && mobile.manifest.display !== 'standalone') note('manifest display is not standalone');
  if (mobile.manifest && mobile.manifest.start_url !== './') note('manifest start_url is not relative');
  if (mobile.manifest && !mobile.manifest.icons.some((i) => i.includes('maskable'))) note('no maskable icon declared');
  if (!mobile.appleTouchIcon) note('no apple-touch-icon link');
  if (!mobile.swSupported) note('service workers unsupported in this runtime');
  if (!mobile.tabbar || mobile.tabLinks !== 4) note(`tab bar missing or incomplete (links=${mobile.tabLinks})`);
  if (!mobile.installCard) note('install card was not rendered');
  if (!mobile.viewport || !mobile.viewport.includes('viewport-fit=cover')) note('viewport is not safe-area aware');
  if (mobile.overflow) note(`mobile layout overflows horizontally: ${mobile.wide.join(', ')}`);
  if (mobile.errors.length) note(`client errors on mobile: ${mobile.errors.join(' | ')}`);
  if (mobile.cards !== 3) note(`expected 3 project cards, saw ${mobile.cards}`);
  if (mobile.cachedCount < 10) note(`precache looks empty (${mobile.cachedCount} entries)`);

  // ---- install prompt wiring --------------------------------------------------------
  // Chromium never fires beforeinstallprompt inside an Electron window, so the handler chain is
  // exercised with a synthetic event: card state, install button and tab-bar button must all react.
  const installSim = await win.webContents.executeJavaScript(`(() => {
    const card = document.getElementById('installCard');
    const before = card ? card.dataset.state : null;
    window.dispatchEvent(new Event('beforeinstallprompt'));
    const btn = document.getElementById('btnInstall');
    const tabBtn = document.getElementById('tabInstall');
    return {
      before,
      after: card ? card.dataset.state : null,
      state: window.__pwaState ? window.__pwaState.installState : null,
      installButtonVisible: btn ? !btn.hidden : null,
      tabInstallVisible: tabBtn ? !tabBtn.hidden : null,
    };
  })()`);
  result.checks.installPrompt = installSim;
  if (installSim.after !== 'available') note(`install card did not switch to an installable state (saw ${installSim.after})`);
  if (!installSim.installButtonVisible) note('install button stayed hidden after beforeinstallprompt');
  if (!installSim.tabInstallVisible) note('tab-bar install button stayed hidden after beforeinstallprompt');

  // ---- scroll to projects + capture -------------------------------------------------
  await win.webContents.executeJavaScript("document.getElementById('projects').scrollIntoView()");
  await new Promise((r) => setTimeout(r, 600));
  result.captures.mobileProjects = path.join(OUT_DIR, 'pwa-mobile-projects.png');
  fs.writeFileSync(result.captures.mobileProjects, (await win.webContents.capturePage()).toPNG());

  // ---- local AI Studio route ---------------------------------------------------------
  const studioConsoleStart = consoleErrors.length;
  await win.loadURL(server.origin + '/studio/');
  await new Promise((r) => setTimeout(r, 700));
  const studio = await win.webContents.executeJavaScript(`(() => {
    const modelCount = document.querySelectorAll('#model-select option').length;
    const canvasPresent = Boolean(document.getElementById('simulation-preview'));
    const template = document.getElementById('template-select');
    if (template) {
      template.value = 'bouncer';
      document.getElementById('apply-template').click();
    }
    const jsonText = (document.getElementById('json-output') || {}).textContent || '';
    return {
      title: document.title,
      modelCount,
      canvasPresent,
      titleAfterTemplate: (document.getElementById('output-title') || {}).textContent || '',
      templateApplied: jsonText.includes('Bouncy room'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      controlledByServiceWorker: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    };
  })()`);
  const studioConsoleMessages = consoleErrors.slice(studioConsoleStart);
  studio.gpuAdapterUnavailable = studioConsoleMessages.some((message) => /No available adapters/i.test(message));
  studio.errors = studioConsoleMessages.filter((message) => !/No available adapters/i.test(message));
  result.checks.studio = studio;
  if (!studio.title.includes('AI Studio')) note(`Studio route title is unexpected: ${studio.title}`);
  if (studio.modelCount !== 3) note(`Studio expected 3 model options, saw ${studio.modelCount}`);
  if (!studio.canvasPresent || !studio.templateApplied || studio.titleAfterTemplate !== 'Bouncy room') note('Studio offline template or safe Canvas2D preview did not initialize');
  if (studio.overflow) note('Studio layout overflows horizontally at the mobile viewport');
  if (studio.errors.length) note(`Studio console errors: ${studio.errors.join(' | ')}`);

  result.captures.studio = path.join(OUT_DIR, 'pwa-studio.png');
  fs.writeFileSync(result.captures.studio, (await win.webContents.capturePage()).toPNG());
  await win.loadURL(server.origin + '/');
  await new Promise((r) => setTimeout(r, 1000));

  // ---- offline reload: server down, cache only --------------------------------------
  await server.close();
  await new Promise((r) => setTimeout(r, 300));

  try {
    await win.webContents.reload();
  } catch (err) {
    note(`reload while offline threw: ${(err && err.message) || err}`);
  }
  await new Promise((r) => setTimeout(r, 2200));

  let offline = null;
  try {
    offline = await win.webContents.executeJavaScript(`(() => ({
      cards: document.querySelectorAll('#projectGrid .card').length,
      docs: document.querySelectorAll('#docColumns button').length,
      firstProject: (document.querySelector('#projectGrid .card h3') || {}).textContent || null,
      title: document.title,
      controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      bodyChars: document.body.textContent.trim().length,
    }))()`);
  } catch (err) {
    note(`offline probe failed: ${(err && err.message) || err}`);
  }
  result.offline = offline || { failed: true };

  if (offline) {
    if (offline.cards !== 3) note(`offline reload did not serve cached content (cards=${offline.cards})`);
    if (!offline.controlled) note('page was not controlled by the service worker offline');
    result.captures.offline = path.join(OUT_DIR, 'pwa-offline.png');
    fs.writeFileSync(result.captures.offline, (await win.webContents.capturePage()).toPNG());
  }

  // ---- desktop viewport -------------------------------------------------------------
  const wide = new BrowserWindow({
    width: 1440, height: 940, show: false, backgroundColor: '#070a12',
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  const server2 = await createPortalServer({
    portalDir: PWA_DIR,
    runtimeInfo: () => ({ mode: 'pwa-static' }),
  });
  await wide.loadURL(server2.origin + '/');
  await new Promise((r) => setTimeout(r, 1600));
  result.checks.desktop = await probe(wide);
  result.captures.desktop = path.join(OUT_DIR, 'pwa-desktop.png');
  fs.writeFileSync(result.captures.desktop, (await wide.webContents.capturePage()).toPNG());
  if (result.checks.desktop.overflow) note(`desktop layout overflows: ${result.checks.desktop.wide.join(', ')}`);
  await server2.close();

  result.ok = problems.length === 0;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  win.destroy();
  wide.destroy();
  app.exit(result.ok ? 0 : 1);
});
