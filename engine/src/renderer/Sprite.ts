import { Color } from '../math/Color';
import { Rectangle } from '../math/Rectangle';
import { Vector2 } from '../math/Vector2';
import { Material } from './Material';
import type { Texture } from './Texture';
import type { Component } from '../core/Component';
import type { Transform } from '../scene/Transform';

export interface SpriteOptions {
  width?: number;
  height?: number;
  color?: Color | string | readonly number[];
  texture?: Texture | null;
  opacity?: number;
  /** Draw order within a layer. */
  layer?: number;
  visible?: boolean;
  /** Normalised pivot, where (0.5, 0.5) centres the sprite on its transform. */
  originX?: number;
  originY?: number;
  flipX?: boolean;
  flipY?: boolean;
}

/**
 * A rectangular drawable.
 *
 * Size defaults to the texture's pixel size, so `new Sprite({ texture })` is usually enough and
 * the material carries tint/opacity rather than the sprite itself.
 */
export class Sprite implements Component {
  static readonly componentName = 'Sprite';

  readonly material: Material;
  width: number;
  height: number;
  layer: number;
  visible: boolean;
  originX: number;
  originY: number;
  flipX: boolean;
  flipY: boolean;

  constructor(options: SpriteOptions = {}) {
    const texture = options.texture ?? null;
    this.material = new Material({
      color: options.color ?? Color.WHITE,
      texture,
      opacity: options.opacity ?? 1,
    });
    this.width = options.width ?? texture?.width ?? 32;
    this.height = options.height ?? texture?.height ?? 32;
    this.layer = options.layer ?? 0;
    this.visible = options.visible ?? true;
    this.originX = options.originX ?? 0.5;
    this.originY = options.originY ?? 0.5;
    this.flipX = options.flipX ?? false;
    this.flipY = options.flipY ?? false;
  }

  get texture(): Texture | null {
    return this.material.texture;
  }

  set texture(value: Texture | null) {
    this.material.texture = value;
  }

  get color(): Color {
    return this.material.color;
  }

  get opacity(): number {
    return this.material.opacity;
  }

  set opacity(value: number) {
    this.material.opacity = value;
  }

  /** Assign a texture and adopt its pixel size in one step. */
  setTexture(texture: Texture | null, adoptSize: boolean = false): this {
    this.material.texture = texture;
    if (texture && adoptSize) {
      this.width = texture.width;
      this.height = texture.height;
    }
    return this;
  }

  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  /** Axis-aligned bounds in world space, accounting for rotation via the expanded extents. */
  bounds(transform: Transform, out: Rectangle = new Rectangle()): Rectangle {
    const cos = Math.abs(Math.cos(transform.worldRotation));
    const sin = Math.abs(Math.sin(transform.worldRotation));
    const scaledWidth = this.width * Math.abs(transform.worldScale.x);
    const scaledHeight = this.height * Math.abs(transform.worldScale.y);
    const extentX = (scaledWidth * cos + scaledHeight * sin) / 2;
    const extentY = (scaledWidth * sin + scaledHeight * cos) / 2;
    return out.set(
      transform.worldPosition.x - extentX,
      transform.worldPosition.y - extentY,
      extentX * 2,
      extentY * 2,
    );
  }

  /** Pivot offset in local pixels, used by the renderer to honour `origin`. */
  get originOffset(): Vector2 {
    return new Vector2(this.width * this.originX, this.height * this.originY);
  }
}
