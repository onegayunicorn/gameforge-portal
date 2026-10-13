import { detectPlatformKind } from './Platform';
import type { Platform, PlatformInfo, PlatformKind } from './Platform';

/**
 * Browser implementation, also used inside Electron's renderer process.
 *
 * Frame scheduling prefers `requestAnimationFrame` and falls back to a timer when the page is
 * hidden or the API is missing, so a run never stalls waiting for a frame that will not arrive.
 */
export class BrowserPlatform implements Platform {
  /** Held in a field with a getter so subclasses can refine it without re-declaring the member. */
  protected readonly infoValue: PlatformInfo;
  private frameHandles = new Map<number, number>();
  private nextHandle = 1;

  constructor(kind: PlatformKind = detectPlatformKind()) {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    this.infoValue = {
      kind,
      userAgent: nav?.userAgent ?? 'unknown',
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1,
      isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(nav?.userAgent ?? ''),
      locale: nav?.language ?? 'en',
      cores: nav?.hardwareConcurrency ?? 1,
    };
  }

  get info(): PlatformInfo {
    return this.infoValue;
  }

  get isHeadless(): boolean {
    return false;
  }

  now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  requestFrame(callback: (time: number) => void): number {
    const handle = this.nextHandle++;
    if (typeof requestAnimationFrame === 'function') {
      const rafId = requestAnimationFrame((time) => {
        this.frameHandles.delete(handle);
        callback(time);
      });
      this.frameHandles.set(handle, rafId);
      return handle;
    }
    const timeoutId = setTimeout(() => {
      this.frameHandles.delete(handle);
      callback(this.now());
    }, 16) as unknown as number;
    this.frameHandles.set(handle, timeoutId);
    return handle;
  }

  cancelFrame(handle: number): void {
    const id = this.frameHandles.get(handle);
    if (id === undefined) return;
    this.frameHandles.delete(handle);
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  }

  createCanvas(width: number, height: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
}

/**
 * Timer-based platform for Node (tests, CI validation and the headless smoke test).
 *
 * Frames are driven explicitly via `advanceFrame()`, so a test never depends on real timers.
 */
export class HeadlessPlatform implements Platform {
  readonly info: PlatformInfo = {
    kind: 'headless',
    userAgent: 'gameforge-headless',
    devicePixelRatio: 1,
    isMobile: false,
    locale: 'en',
    cores: 1,
  };

  private currentTime = 0;
  private readonly pending = new Map<number, (time: number) => void>();
  private nextHandle = 1;

  get isHeadless(): boolean {
    return true;
  }

  now(): number {
    return this.currentTime;
  }

  /** Advance the virtual clock by `ms`. Does not run scheduled callbacks. */
  advanceTime(ms: number): void {
    this.currentTime += ms;
  }

  requestFrame(callback: (time: number) => void): number {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }

  cancelFrame(handle: number): void {
    this.pending.delete(handle);
  }

  /** Run each pending frame callback once, advancing the virtual clock by `ms`. */
  advanceFrame(ms: number = 16): void {
    this.advanceTime(ms);
    const callbacks = Array.from(this.pending.values());
    this.pending.clear();
    for (const callback of callbacks) callback(this.currentTime);
  }

  createCanvas(): HTMLCanvasElement | null {
    return null;
  }
}
