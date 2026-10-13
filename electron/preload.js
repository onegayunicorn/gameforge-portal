'use strict';
/**
 * Preload bridge. Exposes a narrow, whitelisted surface to the portal page:
 * runtime info plus a validated action dispatcher. No node primitives leak through.
 */

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED = new Set([
  'app:info',
  'payload:reveal',
  'payload:recheck',
  'project:reveal',
  'project:openFile',
  'project:copyPath',
  'project:export',
  'portal:openExternal',
]);

contextBridge.exposeInMainWorld('portalAPI', {
  isDesktop: true,
  platform: process.platform,
  info: () => ipcRenderer.invoke('app:info'),
  invoke: (action, payload) => {
    if (!ALLOWED.has(action)) return Promise.resolve({ ok: false, error: `Blocked action: ${action}` });
    return ipcRenderer.invoke(action, payload && typeof payload === 'object' ? payload : {});
  },
});
