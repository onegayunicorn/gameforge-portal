import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPortalServer } from '../../../electron/static-server';

export interface ServeOptions {
  directory: string;
  port?: number;
  host?: string;
}

export interface ServeHandle {
  origin: string;
  port: number;
  close: () => Promise<void>;
}

/** Local addresses a phone or another machine on the network can reach. */
export function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) addresses.push(iface.address);
    }
  }
  return addresses;
}

/**
 * Serve a built game folder.
 *
 * Reuses the portal's read-only static server so directory-URL handling and MIME types are
 * identical to the desktop app and GitHub Pages.
 */
export async function serveDirectory(options: ServeOptions): Promise<ServeHandle> {
  const server = await createPortalServer({
    portalDir: path.resolve(options.directory),
    host: options.host ?? '127.0.0.1',
    port: options.port ?? 0,
    runtimeInfo: () => ({ mode: 'game-preview' }),
  });
  return { origin: server.origin, port: server.port, close: server.close };
}

export interface PreviewCommandOptions {
  repoRoot: string;
  projectDir: string;
  port?: number;
  /** Serve on all interfaces so a phone can reach it. */
  host?: string;
  /** Print the URL and return instead of waiting (used by tests). */
  once?: boolean;
}

/** `gameforge preview <projectDir>` - serve an existing build without rebuilding it. */
export async function runPreview(options: PreviewCommandOptions): Promise<number> {
  const distDir = path.join(path.resolve(options.projectDir), 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error(`No build found at ${path.relative(options.repoRoot, distDir)}. Run \`npm run game:build -- ${options.projectDir}\` first.`);
    return 1;
  }

  const handle = await serveDirectory({ directory: distDir, port: options.port, host: options.host });
  console.log(`Serving ${path.relative(options.repoRoot, distDir)}`);
  console.log(`  local:   ${handle.origin}/`);
  if ((options.host ?? '127.0.0.1') === '0.0.0.0') {
    for (const address of lanAddresses()) console.log(`  network: http://${address}:${handle.port}/`);
  }
  console.log('Press Ctrl+C to stop.');
  if (options.once) {
    await handle.close();
    return 0;
  }

  // Keep the process alive until interrupted.
  await new Promise<void>((resolve) => {
    const shutdown = () => {
      void handle.close().then(() => resolve());
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
  return 0;
}
