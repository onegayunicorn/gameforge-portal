import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPortalServer, type PortalServerHandle } from '../../electron/static-server';

/**
 * Raw request so the client cannot normalise or reject a hostile path before it reaches the server.
 * Resolves with the status code, or the error code if the server dropped the connection.
 */
function rawGet(port: number, requestPath: string): Promise<{ status: number | string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve) => {
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'GET', timeout: 3000 }, (response) => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers }));
    });
    request.on('error', (error: NodeJS.ErrnoException) => resolve({ status: `error:${error.code ?? error.message}`, headers: {} }));
    request.on('timeout', () => { request.destroy(); resolve({ status: 'error:timeout', headers: {} }); });
    request.end();
  });
}

describe('portal static server', () => {
  let dir = '';
  let server: PortalServerHandle;
  const uncaught: Error[] = [];
  const onUncaught = (error: Error) => { uncaught.push(error); };

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gameforge-static-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>ok</title>');
    fs.mkdirSync(path.join(dir, 'data'));
    fs.writeFileSync(path.join(dir, 'data', 'builds.json'), '{}');
    process.on('uncaughtException', onUncaught);
    server = await createPortalServer({ portalDir: dir });
  });

  afterAll(async () => {
    process.off('uncaughtException', onUncaught);
    await server.close();
  });

  it('serves ordinary files', async () => {
    expect((await rawGet(server.port, '/')).status).toBe(200);
    expect((await rawGet(server.port, '/data/builds.json')).status).toBe(200);
    expect((await rawGet(server.port, '/missing.txt')).status).toBe(404);
  });

  it.each([
    ['an invalid percent sequence', '/%E0%A4%A'],
    ['a NUL byte', '/%00'],
    ['a NUL byte before an extension', '/%00.html'],
    ['a NUL byte inside a path', '/data%00/builds.json'],
    ['a NUL byte at the end of a real file', '/data/builds.json%00'],
    ['an encoded traversal', '/%2e%2e/%2e%2e/etc/passwd'],
  ])('refuses %s without crashing, and keeps serving', async (_label, requestPath) => {
    const before = uncaught.length;

    const hostile = await rawGet(server.port, requestPath);
    expect(hostile.status, `${requestPath} must be refused, not drop the connection`).toBe(403);
    expect(uncaught.length, `${requestPath} threw an uncaught exception`).toBe(before);

    // The server must still be alive afterwards.
    expect((await rawGet(server.port, '/')).status).toBe(200);
  });

  it('sends a CSP that keeps the game runtime\'s blob: allowance and stays strict elsewhere', async () => {
    const { headers } = await rawGet(server.port, '/');
    const csp = String(headers['content-security-policy']);
    const directive = (name: string) => csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? '';

    // Same blob: allowance as runtime/index.html, so this header does not silently override it.
    expect(directive('img-src')).toContain('blob:');
    expect(directive('media-src')).toContain('blob:');
    expect(directive('worker-src')).toContain('blob:');

    // Everything that makes the policy worth having.
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('script-src')).toBe("script-src 'self'");
    expect(directive('connect-src')).toBe("connect-src 'self'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
    expect(directive('script-src')).not.toContain('blob:');
  });
});
