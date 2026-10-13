import { Color } from '../../math/Color';
import { Material } from '../Material';
import type { QuadCommand } from '../RenderContext';
import type { Texture } from '../Texture';

export interface QuadOptions {
  /** Centre of the quad in world space. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: Color | string | readonly number[];
  texture?: Texture | null;
  alpha?: number;
  layer?: number;
  blend?: QuadCommand['blend'];
}

/**
 * Build a quad draw command.
 *
 * Primitives are thin factories rather than classes: a command is a plain object the renderer can
 * consume directly, which keeps per-frame allocation predictable.
 */
export function quad(options: QuadOptions): QuadCommand {
  const color = typeof options.color === 'string'
    ? Color.fromHex(options.color)
    : Array.isArray(options.color)
      ? Color.fromArray(options.color as readonly number[])
      : (options.color as Color | undefined)?.clone() ?? Color.WHITE.clone();

  return {
    kind: 'quad',
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    originX: options.width / 2,
    originY: options.height / 2,
    rotation: options.rotation ?? 0,
    material: new Material({ color, texture: options.texture ?? null }),
    alpha: options.alpha ?? 1,
    layer: options.layer ?? 0,
    blend: options.blend ?? 'normal',
    flipX: false,
    flipY: false,
  };
}

/** A solid, untextured rectangle - the cheapest possible drawable. */
export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: Color | string,
  layer: number = 0,
): QuadCommand {
  const command = quad({ x: x + width / 2, y: y + height / 2, width, height, color, layer });
  return command;
}
