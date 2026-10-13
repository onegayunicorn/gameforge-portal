import { BrowserPlatform } from './BrowserPlatform';

/** Shape of the bridge the Electron portal preload script exposes, if it is present. */
export interface RuntimeReporter {
  reportRuntimeState?(state: Record<string, unknown>): void;
  log?(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
}

/**
 * Electron renderer platform.
 *
 * Identical to the browser implementation except that it forwards runtime state and log lines to
 * the desktop shell, which is what lets the portal show a game's live status and capture its
 * console output without the game knowing anything about Electron.
 */
export class ElectronPlatform extends BrowserPlatform {
  private readonly reporter: RuntimeReporter | null;

  constructor(reporter?: RuntimeReporter | null) {
    super('electron');
    this.reporter = reporter ?? (globalThis as unknown as { gameforge?: RuntimeReporter }).gameforge ?? null;
  }

  /** Forward a status update to the shell. No-op when no bridge is present. */
  reportState(state: Record<string, unknown>): void {
    this.reporter?.reportRuntimeState?.(state);
  }

  reportLog(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    this.reporter?.log?.(level, message);
  }

  get hasBridge(): boolean {
    return this.reporter !== null;
  }
}
