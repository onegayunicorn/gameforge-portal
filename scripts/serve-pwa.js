#!/usr/bin/env node
/**
 * Serves the built PWA for phone testing over the local network.
 *
 *   npm run pwa:serve            # http://<lan-ip>:4180
 *   PORT=4180 HOST=0.0.0.0 node scripts/serve-pwa.js
 *
 * Note: browsers only allow service-worker registration and app install on a secure context.
 * `localhost` counts as secure, but a LAN IP over plain HTTP does not - installing on a real
 * phone needs HTTPS (a tunnel or a static host). This server is for layout/behaviour checks.
 */

'use strict';

const os = require('os');
const path = require('path');
const { createPortalServer } = require('../electron/static-server');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 4180);
const HOST = process.env.HOST || '0.0.0.0';

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

createPortalServer({
  portalDir: path.join(ROOT, 'pwa'),
  host: HOST,
  port: PORT,
  runtimeInfo: () => ({ mode: 'pwa-static', productName: 'GameForge Portal' }),
}).then((srv) => {
  const lines = [
    'GameForge Portal PWA (static) is being served:',
    `  local:   http://localhost:${srv.port}/`,
    ...lanAddresses().map((ip) => `  network: http://${ip}:${srv.port}/`),
    '',
    'Install works from https:// or http://localhost. A plain-HTTP LAN address cannot be',
    'installed because service workers require a secure context - use a tunnel or a host.',
    'Press Ctrl+C to stop.',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}).catch((err) => {
  process.stderr.write(`Failed to serve the PWA: ${(err && err.message) || err}\n`);
  process.exit(1);
});
