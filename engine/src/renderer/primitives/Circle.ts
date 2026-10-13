import { Color } from '../../math/Color';
import type { CircleCommand } from '../RenderContext';

export interface CircleOptions {
  x: number;
  y: number;
  radius: number;
  color?: Color | string | readonly number[];
  filled?: boolean;
  lineWidth?: number;
  alpha?: number;
  layer?: number;
  blend?: CircleCommand['blend'];
}

function resolveColor(color: CircleOptions['color']): Color {
  if (typeof color === 'string') return Color.fromHex(color);
  if (Array.isArray(color)) return Color.fromArray(color as readonly number[]);
  return (color as Color | undefined)?.clone() ?? Color.WHITE.clone();
}

export function circle(options: CircleOptions): CircleCommand {
  return {
    kind: 'circle',
    x: options.x,
    y: options.y,
    radius: options.radius,
    color: resolveColor(options.color),
    filled: options.filled ?? true,
    lineWidth: options.lineWidth ?? 1,
    alpha: options.alpha ?? 1,
    layer: options.layer ?? 0,
    blend: options.blend ?? 'normal',
  };
}

export function ring(options: Omit<CircleOptions, 'filled'>): CircleCommand {
  return circle({ ...options, filled: false });
}
