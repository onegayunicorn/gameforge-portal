export interface ErrorScreenOptions {
  /** Called when the user chooses Retry. Defaults to a page reload. */
  onRetry?: () => void;
  /** Extra hint shown under the actions, e.g. how to run the build's dev server. */
  hint?: string;
}

/**
 * Failure overlay.
 *
 * A game that throws during setup or during a frame must show *something* - a blank canvas with a
 * console error is the single most common way to waste an afternoon. The panel shows the phase, the
 * message, the stack (when available) and copies the report to the clipboard on request.
 */
export class ErrorScreen {
  private readonly root: HTMLElement;
  private readonly messageEl: HTMLElement;
  private readonly phaseEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly pre: HTMLPreElement;
  private readonly copyButton: HTMLButtonElement;

  constructor(private readonly container: HTMLElement, private readonly options: ErrorScreenOptions = {}) {
    const panel = document.createElement('div');
    panel.className = 'gf-error';
    panel.setAttribute('role', 'alert');

    const heading = document.createElement('h1');
    heading.textContent = 'The game stopped with an error';

    this.phaseEl = document.createElement('div');
    this.phaseEl.className = 'gf-phase';

    this.pre = document.createElement('pre');
    this.messageEl = document.createElement('span');

    const actions = document.createElement('div');
    actions.className = 'gf-actions';

    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.addEventListener('click', () => {
      if (this.options.onRetry) this.options.onRetry();
      else window.location.reload();
    });

    this.copyButton = document.createElement('button');
    this.copyButton.type = 'button';
    this.copyButton.textContent = 'Copy report';
    this.copyButton.addEventListener('click', () => void this.copyReport());

    actions.append(reload, this.copyButton);

    this.hintEl = document.createElement('p');
    this.hintEl.className = 'gf-hint';
    if (this.options.hint) this.hintEl.textContent = this.options.hint;
    else this.hintEl.hidden = true;

    this.pre.append(this.messageEl);
    panel.append(heading, this.phaseEl, this.pre, actions, this.hintEl);
    this.root = panel;
    this.container.appendChild(panel);
  }

  show(error: unknown, phase: string): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.phaseEl.textContent = `phase: ${phase}`;
    this.messageEl.textContent = err.stack ?? `${err.name}: ${err.message}`;
    this.root.hidden = false;
  }

  private reportText(): string {
    return [
      `phase: ${this.phaseEl.textContent ?? 'unknown'}`,
      `url: ${window.location.href}`,
      `userAgent: ${navigator.userAgent}`,
      '',
      this.messageEl.textContent ?? '',
    ].join('\n');
  }

  private async copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.reportText());
      this.copyButton.textContent = 'Copied';
      setTimeout(() => { this.copyButton.textContent = 'Copy report'; }, 1600);
    } catch {
      this.copyButton.textContent = 'Copy failed';
    }
  }

  hide(): void {
    this.root.remove();
  }

  get element(): HTMLElement {
    return this.root;
  }
}
