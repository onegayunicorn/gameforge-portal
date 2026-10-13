'use strict';
// Focused diagnostic for the offline path: why does the cached document render without data?
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { createPortalServer } = require('../electron/static-server');

const ROOT = path.join(__dirname, '..');
const PWA_DIR = path.join(ROOT, 'pwa');
const log = (s) => process.stdout.write(s + '\n');

app.whenReady().then(async () => {
  const server = await createPortalServer({
    portalDir: PWA_DIR,
    runtimeInfo: () => ({ mode: 'debug' }),
  });

  const win = new BrowserWindow({ width: 390, height: 844, show: false, webPreferences: { sandbox: true } });
  await win.loadURL(server.origin + '/');

  // wait for an active, controlling worker
  for (let i = 0; i < 30; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      'Boolean(window.__pwaState && window.__pwaState.swActive && navigator.serviceWorker.controller)'
    );
    if (ready) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  log('online: ' + JSON.stringify(await win.webContents.executeJavaScript(`(async () => {
    const keys = await caches.keys();
    const c = await caches.open(keys[0]);
    const all = (await c.keys()).map((r) => new URL(r.url).pathname);
    const m = await c.match('./data/builds.json');
    const m2 = await c.match(new Request(new URL('./data/builds.json', location.href).href, { cache: 'no-store' }));
    return { keys, entries: all, matchRelative: Boolean(m), matchNoStoreRequest: Boolean(m2) };
  })()`)));

  await server.close();
  log('server closed');

  await win.webContents.reload();
  await new Promise((r) => setTimeout(r, 2500));

  log('offline: ' + JSON.stringify(await win.webContents.executeJavaScript(`(async () => {
    const appJs = await (async () => {
      try {
        const res = await fetch('./app.js');
        return { status: res.status, bytes: (await res.text()).length, type: res.headers.get('content-type') };
      } catch (e) { return { error: String(e && e.message || e) }; }
    })();
    const callout = document.querySelector('.callout');
    const keys = await caches.keys();
    const c = keys.length ? await caches.open(keys[0]) : null;
    let fetchResult;
    try {
      const res = await fetch('./data/builds.json', { cache: 'no-store' });
      fetchResult = { status: res.status, ok: res.ok, bytes: (await res.text()).length };
    } catch (e) { fetchResult = { error: String(e && e.message || e) }; }
    let cachedDirect;
    try { cachedDirect = Boolean(c && await c.match('./data/builds.json')); } catch (e) { cachedDirect = 'ERR ' + e.message; }
    return {
      cards: document.querySelectorAll('#projectGrid .card').length,
      calloutText: callout ? callout.textContent.trim().slice(0, 200) : null,
      callouts: Array.from(document.querySelectorAll('.callout')).map((el) => el.textContent.trim().slice(0, 70)),
      portalErrors: window.__portalErrors || [],
      hasPortalErrorsKey: '__portalErrors' in window,
      hasPwaStateKey: '__pwaState' in window,
      skeletons: document.querySelectorAll('#statGrid .skeleton-row').length,
      statValues: document.querySelectorAll('#statGrid li .stat-value').length,
      scriptSrcs: Array.from(document.scripts).map((s) => s.getAttribute('src')),
      resources: performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname),
      appJsFetch: appJs,
      controller: Boolean(navigator.serviceWorker.controller),
      cacheEntries: c ? (await c.keys()).length : 0,
      cachedDirect,
      fetchResult,
    };
  })()`)));

  fs.writeFileSync(path.join(ROOT, 'selftest-pwa', 'pwa-offline-debug.png'), (await win.webContents.capturePage()).toPNG());
  win.destroy();
  app.exit(0);
});
