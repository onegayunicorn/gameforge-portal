'use strict';
/**
 * Minimal read-only static server for the portal website.
 * Serves the portal directory plus a single dynamic endpoint (/api/runtime).
 * Bound to loopback only - it never writes and never exposes the filesystem.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function safeResolve(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const full = path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) return null;
  return full;
}

/**
 * @param {{portalDir:string, runtimeInfo:()=>object, host?:string, port?:number}} options
 */
function createPortalServer(options) {
  const { portalDir, runtimeInfo, host = '127.0.0.1', port = 0 } = options;

  const server = http.createServer((req, res) => {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method not allowed');
      return;
    }

    const urlPath = (req.url || '/').split('?')[0];

    if (urlPath === '/api/runtime') {
      let body;
      try { body = JSON.stringify(runtimeInfo()); }
      catch (err) { body = JSON.stringify({ error: String(err && err.message || err) }); }
      res.writeHead(200, { ...headers, 'Content-Type': MIME['.json'] });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }

    const target = urlPath === '/' ? '/index.html' : urlPath;
    let file = safeResolve(portalDir, target);

    // Directory URLs resolve to their index.html, matching how GitHub Pages serves a folder.
    try {
      if (file && fs.statSync(file).isDirectory()) {
        const indexed = safeResolve(portalDir, `${target.replace(/\/+$/, '')}/index.html`);
        if (indexed && fs.existsSync(indexed)) file = indexed;
      }
    } catch { /* not a directory - let readFile produce the 404 */ }

    if (!file) {
      res.writeHead(403, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Not found: ${target}`);
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': buf.length });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      resolve({
        server,
        host,
        port: addr.port,
        origin: `http://${host}:${addr.port}`,
        close: () => new Promise((done) => {
          // Drop keep-alive sockets too, otherwise a "closed" server can still hold requests open.
          try { server.closeAllConnections(); } catch { /* not available on older runtimes */ }
          server.close(() => done());
        }),
      });
    });
  });
}

module.exports = { createPortalServer };
