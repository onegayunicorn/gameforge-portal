import { describe, expect, it } from 'vitest';
import {
  Color,
  Rectangle,
  Vector2,
  MathUtils,
} from '@gameforge/engine';

describe('Vector2', () => {
  it('mutates in place and returns itself so hot loops stay allocation free', () => {
    const vector = new Vector2(1, 2);
    const result = vector.add(new Vector2(3, 4));
    expect(result).toBe(vector);
    expect(vector.x).toBe(4);
    expect(vector.y).toBe(6);
  });

  it('never mutates its operands in the static helpers', () => {
    const a = new Vector2(1, 1);
    const b = new Vector2(2, 2);
    const sum = Vector2.add(a, b);
    expect(sum).not.toBe(a);
    expect(a).toEqual(new Vector2(1, 1));
  });

  it('normalises to unit length and leaves the zero vector alone', () => {
    expect(new Vector2(3, 4).normalize().length).toBeCloseTo(1, 10);
    const zero = new Vector2(0, 0).normalize();
    expect(zero.x).toBe(0);
    expect(zero.y).toBe(0);
    expect(Number.isFinite(zero.length)).toBe(true);
  });

  it('computes rotation, dot and cross consistently', () => {
    const rotated = new Vector2(1, 0).rotate(Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0, 10);
    expect(rotated.y).toBeCloseTo(1, 10);

    expect(Vector2.dot(new Vector2(1, 0), new Vector2(0, 1))).toBe(0);
    expect(Vector2.cross(new Vector2(1, 0), new Vector2(0, 1))).toBe(1);
  });

  it('moves towards a target without overshooting', () => {
    expect(new Vector2(0, 0).moveTowards(new Vector2(10, 0), 3).x).toBeCloseTo(3, 10);
    const arrived = new Vector2(0, 0).moveTowards(new Vector2(2, 0), 5);
    expect(arrived.x).toBe(2);
  });

  it('reports non-finite components (NaN guards in gameplay code rely on this)', () => {
    expect(new Vector2(1, 2).isFinite).toBe(true);
    expect(new Vector2(Number.NaN, 2).isFinite).toBe(false);
  });
});

describe('Rectangle', () => {
  it('computes edges and centre', () => {
    const rect = new Rectangle(10, 20, 30, 40);
    expect([rect.left, rect.top, rect.right, rect.bottom]).toEqual([10, 20, 40, 60]);
    expect([rect.centerX, rect.centerY]).toEqual([25, 40]);
  });

  it('detects intersections and returns null when disjoint', () => {
    const a = new Rectangle(0, 0, 10, 10);
    const b = new Rectangle(5, 5, 10, 10);
    expect(a.intersects(b)).toBe(true);
    expect(a.intersection(b)).toEqual(new Rectangle(5, 5, 5, 5));
    expect(a.intersects(new Rectangle(20, 20, 5, 5))).toBe(false);
    expect(a.intersection(new Rectangle(20, 20, 5, 5))).toBeNull();
  });

  it('treats touching edges as non-overlapping (half-open intervals)', () => {
    expect(new Rectangle(0, 0, 10, 10).intersects(new Rectangle(10, 0, 10, 10))).toBe(false);
    expect(new Rectangle(0, 0, 10, 10).containsPoint(new Vector2(10, 5))).toBe(false);
  });

  it('unions and clamps to bounds', () => {
    const union = new Rectangle(0, 0, 10, 10).union(new Rectangle(20, 20, 5, 5));
    expect(union).toEqual(new Rectangle(0, 0, 25, 25));
    const clamped = new Rectangle(95, 95, 20, 20).clampTo(new Rectangle(0, 0, 100, 100));
    expect(clamped.right).toBeLessThanOrEqual(100);
    expect(clamped.bottom).toBeLessThanOrEqual(100);
  });
});

describe('Color', () => {
  it('parses hex in all supported lengths', () => {
    expect(Color.fromHex('#fff').toHex()).toBe('#ffffff');
    expect(Color.fromHex('#0b1020').toHex()).toBe('#0b1020');
    expect(Color.fromHex('#0b102080').a).toBeCloseTo(0.5, 2);
  });

  it('parses rgb()/rgba() and produces CSS', () => {
    const color = Color.fromHex('rgba(255, 0, 0, 0.5)');
    expect(color.r).toBe(1);
    expect(color.a).toBe(0.5);
    expect(color.toCss()).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('rejects nonsense instead of silently returning black', () => {
    expect(() => Color.fromHex('not-a-colour')).toThrow(/unsupported colour/i);
  });
});

describe('MathUtils', () => {
  it('clamps, lerps and wraps within range', () => {
    expect(MathUtils.clamp(5, 0, 3)).toBe(3);
    expect(MathUtils.clamp(-5, 0, 3)).toBe(0);
    expect(MathUtils.lerp(0, 10, 0.25)).toBe(2.5);
    expect(MathUtils.wrap(370, 0, 360)).toBeCloseTo(10, 10);
    expect(MathUtils.wrap(-10, 0, 360)).toBeCloseTo(350, 10);
  });

  it('produces a deterministic sequence for a given seed', () => {
    const a = MathUtils.createRandom(42);
    const b = MathUtils.createRandom(42);
    const sequenceA = [a(), a(), a()];
    const sequenceB = [b(), b(), b()];
    expect(sequenceA).toEqual(sequenceB);
    for (const value of sequenceA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('computes the next power of two', () => {
    expect(MathUtils.nextPowerOfTwo(1)).toBe(1);
    expect(MathUtils.nextPowerOfTwo(3)).toBe(4);
    expect(MathUtils.nextPowerOfTwo(1024)).toBe(1024);
  });
});
