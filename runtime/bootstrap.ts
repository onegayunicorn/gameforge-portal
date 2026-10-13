import { GameHost } from './GameHost';
import type { GameBuildInfo } from './GameHost';

/**
 * Runtime entry point.
 *
 * The pipeline bundles this file into `engine.js`; the game module is imported dynamically from
 * `game.js` at runtime, so both share the engine chunk and there is exactly one engine instance.
 *
 * Boot order: read build info -> find the shell elements -> hand off to GameHost, which creates the
 * engine, loads assets, imports the game and starts the loop. Any failure before the host exists
 * (missing build info, missing canvas) is reported in the overlay rather than the console alone.
 */

const OVERLAY_ID = 'gameforge-overlay';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Runtime shell is missing #${id} (was index.html regenerated?)`);
  return element as T;
}

/** Show a fatal startup error without the host's overlay being available yet. */
function showFatalOverlay(message: string): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  overlay.hidden = false;
  const panel = document.createElement('div');
  panel.className = 'gf-error';
  panel.setAttribute('role', 'alert');
  const heading = document.createElement('h1');
  heading.textContent = 'This build could not start';
  const body = document.createElement('pre');
  body.textContent = message;
  panel.append(heading, body);
  overlay.appendChild(panel);
}

async function loadBuildInfo(): Promise<GameBuildInfo> {
  // The pipeline writes game.json next to engine.js; an inline global is also accepted so a host
  // page can supply the metadata without a fetch.
  const injected = (globalThis as { __GAMEFORGE_GAME__?: GameBuildInfo }).__GAMEFORGE_GAME__;
  if (injected) return injected;

  const response = await fetch('./game.json', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load ./game.json (HTTP ${response.status}). Is this the build output directory?`);
  }
  return (await response.json()) as GameBuildInfo;
}

export async function boot(): Promise<GameHost | null> {
  const status = requiredElement<HTMLElement>('gameforge-status');
  status.dataset.state = 'booting';

  try {
    const info = await loadBuildInfo();
    document.title = info.name;

    const host = new GameHost({
      info,
      elements: {
        canvas: requiredElement<HTMLCanvasElement>('gameforge-canvas'),
        overlay: requiredElement<HTMLElement>(OVERLAY_ID),
        status,
        restart: requiredElement<HTMLButtonElement>('gameforge-restart'),
        fullscreen: requiredElement<HTMLButtonElement>('gameforge-fullscreen'),
        stage: document.getElementById('gameforge-stage') ?? undefined,
      },
    });

    // Exposed for the portal's preview pane, the Electron shell and the smoke test.
    (globalThis as { gameforgeHost?: GameHost }).gameforgeHost = host;

    await host.start();
    return host;
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    status.dataset.state = 'error';
    showFatalOverlay(message);
    console.error('[gameforge] runtime failed to start', error);
    return null;
  }
}

void boot();
