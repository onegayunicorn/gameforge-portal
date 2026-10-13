export interface ProfileSection {
  name: string;
  /** Milliseconds in the last frame. */
  lastMs: number;
  /** Rolling average over the configured window. */
  averageMs: number;
  peakMs: number;
  calls: number;
}

interface SectionState {
  name: string;
  start: number;
  current: number;
  peak: number;
  total: number;
  calls: number;
  lastFrameSamples: number[];
}

/**
 * Scoped CPU profiler.
 *
 * Sections are re-entrant-safe per name and accumulate into the current frame; `endFrame()`
 * publishes the frame's numbers and resets the accumulators. Disabled sections cost a single
 * boolean check, so the instrumentation can stay in shipping code.
 */
export class Profiler {
  enabled: boolean;
  private readonly sections = new Map<string, SectionState>();
  private readonly open = new Map<string, number>();
  private readonly windowSize: number;

  constructor(enabled: boolean = false, windowSize: number = 60) {
    this.enabled = enabled;
    this.windowSize = Math.max(1, windowSize);
  }

  private sectionFor(name: string): SectionState {
    let section = this.sections.get(name);
    if (!section) {
      section = { name, start: 0, current: 0, peak: 0, total: 0, calls: 0, lastFrameSamples: [] };
      this.sections.set(name, section);
    }
    return section;
  }

  begin(name: string): void {
    if (!this.enabled) return;
    const section = this.sectionFor(name);
    section.start = now();
    this.open.set(name, (this.open.get(name) ?? 0) + 1);
    section.calls += 1;
  }

  end(name: string): void {
    if (!this.enabled) return;
    const depth = this.open.get(name) ?? 0;
    if (depth === 0) return;
    if (depth === 1) this.open.delete(name);
    else this.open.set(name, depth - 1);

    const section = this.sectionFor(name);
    const elapsed = now() - section.start;
    section.current += elapsed;
    if (section.current > section.peak) section.peak = section.current;
  }

  /** Time a function and return its result. */
  measure<T>(name: string, fn: () => T): T {
    if (!this.enabled) return fn();
    this.begin(name);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }

  /** Publish the current frame and start a new one. */
  endFrame(): void {
    if (!this.enabled) return;
    for (const section of this.sections.values()) {
      section.lastFrameSamples.push(section.current);
      if (section.lastFrameSamples.length > this.windowSize) section.lastFrameSamples.shift();
      section.total += section.current;
      section.current = 0;
    }
  }

  /** Section timings for the last frame. */
  report(): ProfileSection[] {
    return Array.from(this.sections.values()).map((section) => {
      const samples = section.lastFrameSamples;
      const average = samples.length === 0 ? 0 : samples.reduce((a, b) => a + b, 0) / samples.length;
      return {
        name: section.name,
        lastMs: samples.length === 0 ? 0 : samples[samples.length - 1],
        averageMs: average,
        peakMs: section.peak,
        calls: section.calls,
      };
    }).sort((a, b) => b.averageMs - a.averageMs);
  }

  /** The single hottest section, or null when nothing has been measured. */
  hottest(): ProfileSection | null {
    const report = this.report();
    return report.length > 0 ? report[0] : null;
  }

  reset(): void {
    this.sections.clear();
    this.open.clear();
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
