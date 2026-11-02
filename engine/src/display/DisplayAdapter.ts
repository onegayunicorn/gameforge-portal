import type { Engine } from '../core/Engine';

export interface DisplayViewport {
  width: number;
  height: number;
  pixelRatio: number;
}

/**
 * Host/display bridge used by the runtime shell.
 *
 * The engine keeps logical game coordinates stable while the adapter owns DOM concerns: observing
 * the host surface, selecting a safe backing-store pixel ratio, and entering fullscreen. This keeps
 * browser/Electron display behaviour out of the renderer and makes another host (UE4 launcher,
 * editor preview, or headless harness) replaceable without changing game code.
 */
export interface DisplayAdapter {
  readonly kind: 'browser-canvas' | 'headless' | 'external';
  attach(engine: Engine): void;
  requestFullscreen(): Promise<void>;
  dispose(): void;
}

export interface BrowserDisplayAdapterOptions {
  canvas: HTMLCanvasElement;
  stage?: HTMLElement;
  logicalWidth: number;
  logicalHeight: number;
  maxPixelRatio?: number;
}

function clampPixelRatio(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(value, Math.max(1, max));
}

/**
 * Responsive display adapter for the shipped Canvas2D backend.
 *
 * It intentionally resizes only the renderer backing store. CSS remains responsible for fitting the
 * canvas into the stage, so a game keeps deterministic logical coordinates at every viewport size.
 */
export class BrowserDisplayAdapter implements DisplayAdapter {
  readonly kind = 'browser-canvas' as const;
  private observer: ResizeObserver | null = null;
  private windowResizeListener: (() => void) | null = null;

  constructor(private readonly options: BrowserDisplayAdapterOptions) {}

  attach(engine: Engine): void {
    const sync = (): void => {
      const pixelRatio = clampPixelRatio(
        typeof window === 'undefined' ? 1 : window.devicePixelRatio,
        this.options.maxPixelRatio ?? 2,
      );
      engine.resize(this.options.logicalWidth, this.options.logicalHeight, pixelRatio);
    };
    this.windowResizeListener = sync;
    if (typeof window !== 'undefined') window.addEventListener('resize', sync, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(sync);
      this.observer.observe(this.options.stage ?? this.options.canvas);
    }
    sync();
  }

  async requestFullscreen(): Promise<void> {
    const target = this.options.stage ?? this.options.canvas;
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (target.requestFullscreen) await target.requestFullscreen();
  }

  dispose(): void {
    if (this.windowResizeListener && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.windowResizeListener);
    }
    this.observer?.disconnect();
    this.observer = null;
    this.windowResizeListener = null;
  }
}
