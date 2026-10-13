export class UIManager {
  private root: HTMLElement;
  private runtime: { getState(): { mode: string } };

  constructor(root: HTMLElement, runtime: { getState(): { mode: string } }) {
    this.root = root;
    this.runtime = runtime;
  }

  render() {
    const state = this.runtime.getState();
    this.root.dataset.mode = state.mode;
    // UI components would render based on runtime mode
  }
}
