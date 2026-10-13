#!/usr/bin/env node
/**
 * Serves the portal as a plain website (no Electron) so it can be opened in any browser.
 * Read-only: static files plus /api/runtime. Desktop-only actions stay disabled in the page.
 */
'use strict';

const path = require('path');
const os = require('os');
const { createPortalServer } = require('../electron/static-server');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const startedAt = new Date().toISOString();

const runtimeInfo = () => ({
  mode: 'browser',
  productName: 'GameForge Portal',
  appVersion: require(path.join(ROOT, 'package.json')).version,
  node: process.versions.node,
  v8: process.versions.v8,
  isPackaged: false,
  platform: `${os.type()} ${os.release()}`,
  arch: process.arch,
  cpus: os.cpus().length,
  totalMem: os.totalmem(),
  locale: Intl.DateTimeFormat().resolvedOptions().locale + ' / ' + Intl.DateTimeFormat().resolvedOptions().timeZone,
  startedAt,
  serverHost: HOST,
  serverPort: PORT,
  payloadPath: path.join(ROOT, 'payload'),
});

createPortalServer({
  portalDir: path.join(ROOT, 'portal'),
  runtimeInfo,
  host: HOST,
  port: PORT,
}).then((srv) => {
  process.stdout.write(`GameForge Portal (browser mode) listening on ${srv.origin}\n`);
}).catch((err) => {
  process.stderr.write(`Failed to start portal server: ${err && err.message}\n`);
  process.exit(1);
});
