/**
 * Types for the plain-JavaScript static server used by the desktop app, the portal's preview pane
 * and the CLI's dev/preview commands.
 *
 * The implementation stays JavaScript because Electron's main process loads it directly, without a
 * build step; this declaration file is what lets the TypeScript side (pipeline, CLI, tests) import
 * it with real types instead of `any`.
 */
export interface PortalServerOptions {
  /** Directory to serve. Directory URLs resolve to their `index.html`, as GitHub Pages does. */
  portalDir: string;
  /** Dynamic payload for `/api/runtime`. Omit when the host has no runtime to report. */
  runtimeInfo?: () => Record<string, unknown>;
  /** Bind address. Defaults to `127.0.0.1`. */
  host?: string;
  /** Port. Defaults to 0, which lets the OS choose a free port. */
  port?: number;
}

export interface PortalServerHandle {
  /** Base URL, e.g. `http://127.0.0.1:51234`. */
  origin: string;
  /** The port actually bound. */
  port: number;
  /** Stop serving and drop keep-alive connections. Safe to call more than once. */
  close: () => Promise<void>;
}

export function createPortalServer(options: PortalServerOptions): Promise<PortalServerHandle>;
