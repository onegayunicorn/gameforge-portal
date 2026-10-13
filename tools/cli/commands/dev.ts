import fs from 'node:fs';
import path from 'node:path';
import { buildGame } from '../../../pipeline/game-builder';
import { runPreview } from './preview';

export interface DevCommandOptions {
  repoRoot: string;
  projectDir: string;
  port?: number;
  host?: string;
  /** Rebuild when a source file changes. */
  watch: boolean;
}

const WATCH_EXTENSIONS = new Set(['.ts', '.js', '.json', '.html', '.css', '.png', '.jpg', '.webp']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git']);

/**
 * `gameforge dev <projectDir>` - build, serve, and rebuild on change.
 *
 * This is deliberately "build + reload", not hot module replacement: an HMR runtime needs module
 * ordering guarantees the engine does not provide yet, and a reload that always reflects the last
 * successful build is more trustworthy than a fast one that sometimes does not. HMR is tracked in
 * docs/ROADMAP.md.
 */
export async function runDev(options: DevCommandOptions): Promise<number> {
  const projectDir = path.resolve(options.projectDir);
  const distDir = path.join(projectDir, 'dist');

  const build = async (reason: string): Promise<boolean> => {
    const started = Date.now();
    const { report } = await buildGame({ projectDir, repoRoot: options.repoRoot, minify: false, sourcemap: true });
    const status = report.status === 'success' ? 'ok' : 'FAILED';
    console.log(`[${new Date().toLocaleTimeString()}] ${reason}: ${status} in ${Date.now() - started}ms`);
    for (const warning of report.warnings) console.log(`   warn ${warning.code}: ${warning.message}`);
    for (const error of report.errors) console.log(`   ERROR ${error.code}: ${error.message}`);
    return report.status === 'success';
  };

  if (!(await build('initial build'))) {
    console.error('Initial build failed; fix the errors above and run again.');
    return 1;
  }

  // The static server tolerates a rebuild in place, so no restart is needed after a change.
  const handle = await (async () => {
    const { serveDirectory } = await import('./preview');
    return serveDirectory({ directory: distDir, port: options.port ?? 4300, host: options.host });
  })();

  console.log(`Dev server: ${handle.origin}/`);
  console.log('Reload the page after a change (HMR is not implemented yet).');

  if (!options.watch) {
    await handle.close();
    return 0;
  }

  let pending: NodeJS.Timeout | null = null;
  const schedule = (file: string): void => {
    if (pending) clearTimeout(pending);
    // Editors write in bursts (temp file + rename); debounce so one save is one build.
    pending = setTimeout(() => {
      void build(`change ${path.relative(projectDir, file)}`);
    }, 120);
  };

  const watcher = fs.watch(projectDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const parts = filename.split(path.sep);
    if (parts.some((part) => IGNORED_DIRS.has(part))) return;
    if (!WATCH_EXTENSIONS.has(path.extname(filename))) return;
    schedule(path.join(projectDir, filename));
  });

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      watcher.close();
      void handle.close().then(() => resolve());
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
  void runPreview; // keeps the import meaningful if preview's server is replaced later
  return 0;
}
