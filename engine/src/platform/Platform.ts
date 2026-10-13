export type PlatformKind = 'browser' | 'electron' | 'headless';

export interface PlatformInfo {
  kind: PlatformKind;
  userAgent: string;
  devicePixelRatio: number;
  isMobile: boolean;
  locale: string;
  /** Hardware concurrency, when the host exposes it. */
  cores: number;
}

/**
 * Host abstraction.
 *
 * Everything that differs between a browser, the Electron shell and a headless CI run lives behind
 * this interface, so the engine core never touches `window`, `document` or timers directly.
 */
export interface Platform {
  readonly info: PlatformInfo;
  /** Monotonic milliseconds. */
  now(): number;
  /** Schedule the next frame. Headless platforms run the callback via a timer. */
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(handle: number): void;
  /** True when there is no rendering surface (tests, server-side validation). */
  readonly isHeadless: boolean;
  /** Create a canvas when the host supports it; null in headless environments. */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement | null;
}

export function detectPlatformKind(): PlatformKind {
  if (typeof window === 'undefined') return 'headless';
  const maybeElectron = window as unknown as { gameforge?: unknown; process?: unknown };
  if (maybeElectron.gameforge || (maybeElectron.process as { versions?: { electron?: string } } | undefined)?.versions?.electron) {
    return 'electron';
  }
  return 'browser';
}
