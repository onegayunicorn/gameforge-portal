/**
 * Loading overlay.
 *
 * Built with DOM calls rather than innerHTML so a game title containing markup cannot inject into
 * the shell. Progress is driven by the engine's asset events; a code-only game skips straight from
 * "starting" to hidden.
 */
export class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private readonly fillEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;

  constructor(private readonly container: HTMLElement, title: string) {
    const panel = document.createElement('div');
    panel.className = 'gf-loading';

    this.titleEl = document.createElement('h1');
    this.titleEl.textContent = title;

    this.subtitleEl = document.createElement('p');
    this.subtitleEl.textContent = 'Starting engine…';

    const track = document.createElement('div');
    track.className = 'gf-track';
    this.fillEl = document.createElement('div');
    this.fillEl.className = 'gf-fill';
    track.appendChild(this.fillEl);

    this.detailEl = document.createElement('div');
    this.detailEl.className = 'gf-detail';

    panel.append(this.titleEl, this.subtitleEl, track, this.detailEl);
    this.root = panel;
    this.container.appendChild(panel);
  }

  setSubtitle(text: string): void {
    this.subtitleEl.textContent = text;
  }

  setTitle(text: string): void {
    this.titleEl.textContent = text;
  }

  /** Update the bar. `ratio` is clamped, so callers may pass raw counts. */
  setProgress(loaded: number, total: number, currentId?: string | null): void {
    const ratio = total <= 0 ? 1 : Math.min(1, Math.max(0, loaded / total));
    this.fillEl.style.width = `${Math.round(ratio * 100)}%`;
    this.subtitleEl.textContent = total <= 0
      ? 'Starting engine…'
      : `Loading assets ${loaded}/${total}`;
    this.detailEl.textContent = currentId ?? '';
  }

  fail(message: string): void {
    this.subtitleEl.textContent = message;
    this.fillEl.style.width = '100%';
    this.fillEl.style.background = 'linear-gradient(90deg, #ff8080, #ff5c7c)';
  }

  hide(): void {
    this.root.remove();
  }

  get element(): HTMLElement {
    return this.root;
  }
}
