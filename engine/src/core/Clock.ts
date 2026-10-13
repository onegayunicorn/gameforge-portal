/**
 * Time source for the game loop.
 *
 * The clock is deliberately separate from the loop: tests and headless runs drive it with
 * `step()` so a simulation can be advanced by an exact number of seconds, while a browser run
 * drives it from the platform's monotonic timer.
 */
export class Clock {
  private lastTimestamp = 0;
  private running = false;
  private paused = false;
  private elapsedSeconds = 0;
  private frameCountValue = 0;
  private timeScaleValue = 1;
  private currentDelta = 0;
  private readonly now: () => number;

  constructor(now?: () => number) {
    this.now = now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTimestamp = this.now();
    this.currentDelta = 0;
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.currentDelta = 0;
  }

  pause(): void {
    this.paused = true;
    this.currentDelta = 0;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    // Skip the paused interval instead of reporting it as one enormous frame.
    this.lastTimestamp = this.now();
    this.currentDelta = 0;
  }

  reset(): void {
    this.lastTimestamp = this.now();
    this.elapsedSeconds = 0;
    this.frameCountValue = 0;
    this.currentDelta = 0;
  }

  /**
   * Advance to the current wall-clock time and return the delta in seconds.
   * Returns 0 while stopped or paused so callers can simply accumulate the result.
   */
  tick(): number {
    if (!this.running || this.paused) {
      this.currentDelta = 0;
      return 0;
    }
    // The clock stores milliseconds; the engine works in seconds throughout.
    const timestamp = this.now();
    const rawDeltaSeconds = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    this.currentDelta = Math.max(0, rawDeltaSeconds) * this.timeScaleValue;
    this.elapsedSeconds += this.currentDelta;
    this.frameCountValue += 1;
    return this.currentDelta;
  }

  /**
   * Advance manually by an exact amount. Used by deterministic tests and headless simulation.
   * `deltaSeconds` is scaled like a real frame so timeScale is honoured.
   */
  step(deltaSeconds: number): number {
    const scaled = Math.max(0, deltaSeconds) * this.timeScaleValue;
    this.currentDelta = scaled;
    this.elapsedSeconds += scaled;
    this.frameCountValue += 1;
    return scaled;
  }

  setTimeScale(scale: number): void {
    this.timeScaleValue = Math.max(0, scale);
  }

  get timeScale(): number {
    return this.timeScaleValue;
  }

  get delta(): number {
    return this.currentDelta;
  }

  get elapsed(): number {
    return this.elapsedSeconds;
  }

  get frameCount(): number {
    return this.frameCountValue;
  }

  get isRunning(): boolean {
    return this.running && !this.paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }
}
