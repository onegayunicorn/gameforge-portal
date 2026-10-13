'use strict';
// Diagnostic: confirm the main process can reach its own loopback portal server.
const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const { createPortalServer } = require('../electron/static-server');

const out = [];
const log = (s) => { out.push(s); process.stdout.write(s + '\n'); };

function probe(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let n = 0;
      res.on('data', (c) => { n += c.length; });
      res.on('end', () => resolve({ status: res.statusCode, bytes: n }));
    }).on('error', (e) => resolve({ error: String(e && e.message || e) }));
  });
}

app.whenReady().then(async () => {
  const srv = await createPortalServer({
    portalDir: path.join(__dirname, '..', 'portal'),
    runtimeInfo: () => ({ mode: 'diag' }),
  });
  log('origin: ' + srv.origin);
  log('node probe /: ' + JSON.stringify(await probe(srv.origin + '/')));

  const win = new BrowserWindow({ width: 900, height: 700, show: false, webPreferences: { sandbox: true } });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log(`did-fail-load ${code} ${desc} ${url}`));
  try {
    await win.loadURL(srv.origin + '/');
    log('loadURL ok, title=' + (await win.webContents.executeJavaScript('document.title')));
    log('cards=' + (await win.webContents.executeJavaScript('document.querySelectorAll(".card").length')));
  } catch (err) {
    log('loadURL failed: ' + String(err && err.message || err));
  }
  await srv.close();
  app.exit(0);
});
