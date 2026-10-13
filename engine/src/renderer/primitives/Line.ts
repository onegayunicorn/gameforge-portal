import { Color } from '../../math/Color';
import type { LineCommand } from '../RenderContext';

export interface LineOptions {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: Color | string | readonly number[];
  width?: number;
  alpha?: number;
  layer?: number;
  blend?: LineCommand['blend'];
}

function resolveColor(color: LineOptions['color']): Color {
  if (typeof color === 'string') return Color.fromHex(color);
  if (Array.isArray(color)) return Color.fromArray(color as readonly number[]);
  return (color as Color | undefined)?.clone() ?? Color.WHITE.clone();
}

export function line(options: LineOptions): LineCommand {
  return {
    kind: 'line',
    x1: options.x1,
    y1: options.y1,
    x2: options.x2,
    y2: options.y2,
    color: resolveColor(options.color),
    width: options.width ?? 1,
    alpha: options.alpha ?? 1,
    layer: options.layer ?? 0,
    blend: options.blend ?? 'normal',
  };
}
