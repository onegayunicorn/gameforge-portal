'use strict';
/**
 * Preload bridge. Exposes a narrow, whitelisted surface:
 *  - `portalAPI` to the portal page: runtime info, a validated action dispatcher, and a
 *    subscription for live state pushed by a running game window
 *  - `gameforge` to a game's runtime shell: state reporting and log forwarding
 *
 * No node primitives leak through, and the renderer can only name actions from ALLOWED - it can
 * never supply a command, an argument or a filesystem path of its own.
 */

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED = new Set([
  // portal payload actions
  'app:info',
  'payload:reveal',
  'payload:recheck',
  'project:reveal',
  'project:openFile',
  'project:copyPath',
  'project:export',
  'portal:openExternal',
  // engine game actions (ids are validated against portal/data/games.json in the main process)
  'game:build',
  'game:validate',
  'game:preview',
  'game:stop',
  'game:logs',
  'game:source',
  'game:buildFolder',
]);

contextBridge.exposeInMainWorld('portalAPI', {
  isDesktop: true,
  platform: process.platform,
  info: () => ipcRenderer.invoke('app:info'),
  invoke: (action, payload) => {
    if (!ALLOWED.has(action)) return Promise.resolve({ ok: false, error: `Blocked action: ${action}` });
    return ipcRenderer.invoke(action, payload && typeof payload === 'object' ? payload : {});
  },
  /** Live runtime state pushed from a game window. Returns an unsubscribe function. */
  onGameRuntime: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('game:runtime', listener);
    return () => ipcRenderer.removeListener('game:runtime', listener);
  },
});

// The game runtime shell (runtime/GameHost.ts) looks for this bridge when it runs inside Electron,
// which is how a launched game reports its FPS, entity count and logs back to the shell.
contextBridge.exposeInMainWorld('gameforge', {
  isElectron: true,
  reportRuntimeState: (state) => {
    if (state && typeof state === 'object') ipcRenderer.send('gameforge:runtime', state);
  },
  log: (level, message) => {
    ipcRenderer.send('gameforge:log', { level: String(level), message: String(message) });
  },
});
