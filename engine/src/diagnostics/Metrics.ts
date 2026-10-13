/** Point-in-time engine counters, also what the portal and the editor display. */
export interface MetricsSnapshot {
  frames: number;
  fps: number;
  frameTimeMs: number;
  updateSteps: number;
  entities: number;
  drawCalls: number;
  quads: number;
  circles: number;
  lines: number;
  layers: number;
  drawTimeMs: number;
  elapsedSeconds: number;
  /** Peak values since the last `reset()` - useful for spotting spikes. */
  peakFrameTimeMs: number;
  peakDrawCalls: number;
}

/**
 * Rolling metrics with a fixed-size sample window.
 *
 * Averages are computed from the window rather than a decaying constant so the numbers stay
 * readable and reproducible in tests (a fixed number of identical frames yields exactly that
 * frame time).
 */
export class Metrics {
  private readonly samples: number[] = [];
  private readonly windowSize: number;
  private framesValue = 0;
  private updateStepsValue = 0;
  private entitiesValue = 0;
  private drawCallsValue = 0;
  private quadsValue = 0;
  private circlesValue = 0;
  private linesValue = 0;
  private layersValue = 0;
  private drawTimeValue = 0;
  private elapsedValue = 0;
  private peakFrameTime = 0;
  private peakDrawCalls = 0;

  constructor(windowSize: number = 60) {
    this.windowSize = Math.max(1, windowSize);
  }

  /** Called once per rendered frame by the Engine. */
  recordFrame(frameTimeMs: number): void {
    this.framesValue += 1;
    this.samples.push(frameTimeMs);
    if (this.samples.length > this.windowSize) this.samples.shift();
    if (frameTimeMs > this.peakFrameTime) this.peakFrameTime = frameTimeMs;
  }

  /** Called once per simulation step. */
  recordUpdateSteps(steps: number): void {
    this.updateStepsValue += steps;
  }

  recordRender(stats: {
    drawCalls: number;
    quads: number;
    circles: number;
    lines: number;
    layers: number;
    drawTimeMs: number;
  }): void {
    this.drawCallsValue = stats.drawCalls;
    this.quadsValue = stats.quads;
    this.circlesValue = stats.circles;
    this.linesValue = stats.lines;
    this.layersValue = stats.layers;
    this.drawTimeValue = stats.drawTimeMs;
    if (stats.drawCalls > this.peakDrawCalls) this.peakDrawCalls = stats.drawCalls;
  }

  recordWorld(entities: number, elapsedSeconds: number): void {
    this.entitiesValue = entities;
    this.elapsedValue = elapsedSeconds;
  }

  get averageFrameTimeMs(): number {
    if (this.samples.length === 0) return 0;
    let total = 0;
    for (const sample of this.samples) total += sample;
    return total / this.samples.length;
  }

  get fps(): number {
    const average = this.averageFrameTimeMs;
    return average > 0 ? 1000 / average : 0;
  }

  snapshot(): MetricsSnapshot {
    return {
      frames: this.framesValue,
      fps: this.fps,
      frameTimeMs: this.averageFrameTimeMs,
      updateSteps: this.updateStepsValue,
      entities: this.entitiesValue,
      drawCalls: this.drawCallsValue,
      quads: this.quadsValue,
      circles: this.circlesValue,
      lines: this.linesValue,
      layers: this.layersValue,
      drawTimeMs: this.drawTimeValue,
      elapsedSeconds: this.elapsedValue,
      peakFrameTimeMs: this.peakFrameTime,
      peakDrawCalls: this.peakDrawCalls,
    };
  }

  reset(): void {
    this.samples.length = 0;
    this.framesValue = 0;
    this.updateStepsValue = 0;
    this.drawCallsValue = 0;
    this.quadsValue = 0;
    this.circlesValue = 0;
    this.linesValue = 0;
    this.layersValue = 0;
    this.drawTimeValue = 0;
    this.peakFrameTime = 0;
    this.peakDrawCalls = 0;
  }
}
