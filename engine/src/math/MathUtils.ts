/** Scalar helpers shared by the math layer. Kept dependency-free and allocation-free. */

export const EPSILON = 1e-6;
export const TAU = Math.PI * 2;
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return Math.abs(b - a) < EPSILON ? 0 : clamp01((value - a) / (b - a));
}

/** Remap a value from one range to another without clamping. */
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + (outMax - outMin) * inverseLerp(inMin, inMax, value);
}

export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG;
}

/** Wrap a value into [min, max). */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;
  return ((((value - min) % range) + range) % range) + min;
}

export function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

export function approximately(a: number, b: number, tolerance: number = EPSILON): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01(inverseLerp(edge0, edge1, value));
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach (a "damp" rather than a naive lerp). */
export function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * deltaSeconds));
}

/** Smallest power of two greater than or equal to value. */
export function nextPowerOfTwo(value: number): number {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

export function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

/** Deterministic pseudo-random generator (mulberry32) so simulations can be replayed. */
export function createRandom(seed: number = 0x9e3779b9): () => number {
  let state = seed >>> 0;
  return function random(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(min: number, max: number, random: () => number = Math.random): number {
  return min + (max - min) * random();
}
