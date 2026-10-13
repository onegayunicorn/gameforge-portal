'use strict';
/**
 * Audits the published landing page (repo root index.html) the way GitHub Pages will serve it:
 * a static host with no rewriting. Confirms the page reads the shipped index live, that the
 * install/download affordances are present, and that nothing overflows or throws.
 *
 *   electron scripts/site-audit.js <outDir>
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { createPortalServer } = require('../electron/static-server');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = process.argv[2] || path.join(ROOT, 'selftest-site');
const problems = [];
const note = (m) => problems.push(m);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 940, scrollTo: 0 },
  { name: 'mobile', width: 390, height: 844, scrollTo: 0 },
  { name: 'mobile-builds', width: 390, height: 844, scrollTo: 1100 },
];

const PROBE = `(() => {
  const txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : null; };
  // Only elements that actually push the document are interesting: anything inside a scroll
  // container (the download table) is clipped on purpose and is not a layout defect.
  const inScroller = (el) => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      if (getComputedStyle(n).overflowX !== 'visible') return true;
      n = n.parentElement;
    }
    return false;
  };
  const wide = Array.from(document.querySelectorAll('body *'))
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2 && !inScroller(el))
    .slice(0, 6).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));
  return {
    title: document.title,
    stats: Array.from(document.querySelectorAll('#statGrid > div')).map((d) => ({
      value: (d.querySelector('strong') || {}).textContent?.trim(),
      label: (d.querySelector('span') || {}).textContent?.trim(),
    })),
    skeletonsLeft: document.querySelectorAll('#statGrid .skeleton').length,
    buildCards: document.querySelectorAll('#buildGrid .card').length,
    buildTitles: Array.from(document.querySelectorAll('#buildGrid .card h3')).map((h) => h.textContent.trim()),
    bars: document.querySelectorAll('#buildGrid .bar-row').length,
    downloadRows: document.querySelectorAll('#downloadRows tr').length,
    downloadLinks: Array.from(document.querySelectorAll('#downloadRows a')).map((a) => a.getAttribute('href')),
    envPill: txt('#envText'),
    heroNote: txt('#heroNote'),
    offlineNoticeShown: document.querySelector('#offlineNote')?.dataset.show === 'true',
    standalone: Boolean(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    // The wide download table must stay reachable by scrolling, not clipped away.
    tableScrollable: (() => {
      const w = document.querySelector('.table-wrap');
      return w ? w.scrollWidth > w.clientWidth + 2 : null;
    })(),
    wide,
    errors: window.__siteErrors || [],
  };
})()`;

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    process.stderr.write('index.html missing at the repo root\n');
    app.exit(1);
    return;
  }

  const server = await createPortalServer({
    portalDir: ROOT, // exactly what Pages publishes
    runtimeInfo: () => ({ mode: 'static-site' }),
  });

  const result = { origin: server.origin, viewports: {}, captures: {}, problems };

  // Asset availability exactly as a static host would answer.
  const assets = ['/', '/index.html', '/.nojekyll', '/pwa/', '/pwa/manifest.webmanifest', '/pwa/sw.js', '/pwa/data/builds.json', '/pwa/build-info.json'];
  result.checks = {};
  for (const a of assets) {
    try {
      const res = await fetch(new URL(a, server.origin).href, { cache: 'no-store' });
      result.checks[a] = res.status;
      if (res.status !== 200) note(`asset not served: ${a} -> ${res.status}`);
    } catch (err) {
      result.checks[a] = 'ERR ' + (err && err.message);
      note(`asset request failed: ${a} -> ${result.checks[a]}`);
    }
  }

  const win = new BrowserWindow({
    width: 1440, height: 940, show: false, backgroundColor: '#070a12',
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) process.stderr.write(`console: ${message}\n`);
  });

  for (const vp of VIEWPORTS) {
    win.setContentSize(vp.width, vp.height);
    // Uncaught page errors surface through the console-message handler above; the hook below
    // additionally catches errors raised after load (e.g. from the data fetch).
    await win.loadURL(server.origin + '/');
    await win.webContents.executeJavaScript(
      `window.__siteErrors = []; window.addEventListener('error', (e) => window.__siteErrors.push(String(e.message || e)));`
    );
    await new Promise((r) => setTimeout(r, 1500));
    if (vp.scrollTo) {
      await win.webContents.executeJavaScript(`window.scrollTo(0, ${vp.scrollTo})`);
      await new Promise((r) => setTimeout(r, 500));
    }
    const probe = await win.webContents.executeJavaScript(PROBE);
    result.viewports[vp.name] = probe;
    result.captures[vp.name] = path.join(OUT_DIR, `site-${vp.name}.png`);
    fs.writeFileSync(result.captures[vp.name], (await win.webContents.capturePage()).toPNG());
  }

  await server.close();

  // Assertions against the desktop viewport plus the mobile layout pass.
  const d = result.viewports.desktop;
  const m = result.viewports.mobile;

  if (d.skeletonsLeft) note(`stat placeholders were never replaced (${d.skeletonsLeft} skeletons left)`);
  if (d.buildCards !== 3) note(`expected 3 build cards, saw ${d.buildCards}`);
  if (d.bars < 12) note(`module bars look missing (${d.bars})`);
  if (d.downloadRows < 4) note(`expected 4 download rows, saw ${d.downloadRows}`);
  if (!d.downloadLinks.every((h) => h && h.includes('/releases/'))) note('a download link does not point at the release');
  if (d.offlineNoticeShown) note('live index could not be read from the served page');
  if (!d.envPill) note('environment pill did not render');
  for (const vp of VIEWPORTS) {
    const p = result.viewports[vp.name];
    if (p.overflow) note(`${vp.name} overflows horizontally: ${p.wide.join(', ')}`);
    if (p.errors.length) note(`${vp.name} client errors: ${p.errors.join(' | ')}`);
  }
  if (m.buildCards !== 3) note(`mobile did not render the build cards (${m.buildCards})`);

  result.ok = problems.length === 0;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  win.destroy();
  app.exit(result.ok ? 0 : 1);
});
