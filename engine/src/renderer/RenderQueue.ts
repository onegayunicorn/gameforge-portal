import type { DrawCommand } from './RenderContext';
import type { Renderer } from './Renderer';

interface QueuedCommand {
  command: DrawCommand;
  sequence: number;
}

/**
 * Collects draw commands for a frame, then submits them in a deterministic order.
 *
 * Sorting is by layer first and insertion order second, so two sprites on the same layer keep the
 * order the systems queued them - a stable sort is what makes replayable rendering possible.
 */
export class RenderQueue {
  private items: QueuedCommand[] = [];
  private sequence = 0;
  private sorted = true;

  add(command: DrawCommand): void {
    this.items.push({ command, sequence: this.sequence++ });
    this.sorted = false;
  }

  get size(): number {
    return this.items.length;
  }

  /** Distinct layers present in the queue, used for renderer diagnostics. */
  get layerCount(): number {
    const layers = new Set<number>();
    for (const item of this.items) layers.add(item.command.layer);
    return layers.size;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Stable sort by layer, then by insertion order. */
  sort(): void {
    if (this.sorted) return;
    this.items.sort((a, b) => {
      const layerDelta = a.command.layer - b.command.layer;
      return layerDelta !== 0 ? layerDelta : a.sequence - b.sequence;
    });
    this.sorted = true;
  }

  /** Submit everything to a renderer, then empty the queue. */
  flush(renderer: Renderer): number {
    this.sort();
    for (const item of this.items) renderer.draw(item.command);
    const drawn = this.items.length;
    this.clear();
    return drawn;
  }

  clear(): void {
    this.items.length = 0;
    this.sequence = 0;
    this.sorted = true;
  }
}
