import { Color } from '../math/Color';
import { Sprite } from '../renderer/Sprite';
import { Camera } from '../renderer/Camera';
import { Transform } from '../scene/Transform';
import { SystemPriority } from '../core/System';
import type { System } from '../core/System';
import type { World } from '../core/World';
import type { Renderer } from '../renderer/Renderer';
import type { QuadCommand } from '../renderer/RenderContext';
import type { Metrics } from '../diagnostics/Metrics';
import type { Profiler } from '../diagnostics/Profiler';

export interface RenderSystemOptions {
  renderer: Renderer;
  /** Explicit camera. When omitted, the first Camera component in the scene is used. */
  camera?: Camera | null;
  clearColor?: Color | string;
  /** Skip sprites outside the camera's view. */
  cull?: boolean;
}

/**
 * Turns sprites into draw commands, sorts them and submits them to the renderer.
 *
 * The queue is cleared after each flush, so producers (debug draw, UI in milestone 6) should add
 * their commands during the render phase - the sprite pass happens first because it runs before
 * them in this flush.
 */
export class RenderSystem implements System {
  readonly name = 'RenderSystem';
  readonly priority = SystemPriority.Render;

  private readonly renderer: Renderer;
  private cameraOverride: Camera | null;
  private readonly clearColor: Color;
  private readonly cull: boolean;
  private metrics: Metrics | null = null;
  private profiler: Profiler | null = null;
  private readonly fallbackCamera = new Camera();
  private cameraSource: 'override' | 'scene' | 'fallback' = 'fallback';

  constructor(options: RenderSystemOptions) {
    this.renderer = options.renderer;
    this.cameraOverride = options.camera ?? null;
    this.clearColor = typeof options.clearColor === 'string'
      ? Color.fromHex(options.clearColor)
      : options.clearColor ?? Color.fromHex('#0b1020');
    this.cull = options.cull ?? true;
  }

  initialize(world: World): void {
    this.metrics = (world.services as { metrics?: Metrics | null }).metrics ?? null;
    this.profiler = (world.services as { profiler?: Profiler | null }).profiler ?? null;
  }

  setCamera(camera: Camera | null): void {
    this.cameraOverride = camera;
  }

  render(world: World, _alpha: number): void {
    this.profiler?.begin(this.name);
    try {
      const queue = world.renderQueue;

      const camera = this.resolveCamera(world);
      this.renderer.beginFrame({ clearColor: this.clearColor, camera });

      const visibleBounds = this.cull ? camera.visibleBounds() : null;

      for (const match of world.query(Sprite, Transform)) {
        const sprite = match.components[0] as Sprite;
        const transform = match.components[1] as Transform;
        if (!sprite.visible || sprite.opacity <= 0) continue;

        if (visibleBounds) {
          const bounds = sprite.bounds(transform);
          if (!visibleBounds.intersects(bounds)) continue;
        }

        queue.add(this.buildQuad(match.entity, sprite, transform));
      }

      const drawn = queue.flush(this.renderer);
      this.renderer.endFrame();
      this.metrics?.recordRender({ ...this.renderer.stats, drawCalls: drawn });
    } finally {
      this.profiler?.end(this.name);
    }
  }

  private buildQuad(entity: number, sprite: Sprite, transform: Transform): QuadCommand {
    void entity;
    const material = sprite.material;
    return {
      kind: 'quad',
      x: transform.worldPosition.x,
      y: transform.worldPosition.y,
      width: sprite.width,
      height: sprite.height,
      originX: sprite.originOffset.x,
      originY: sprite.originOffset.y,
      rotation: transform.worldRotation,
      material,
      alpha: 1,
      layer: sprite.layer + transform.zIndex,
      blend: material.blend,
      flipX: sprite.flipX,
      flipY: sprite.flipY,
    };
  }

  private resolveCamera(world: World): Camera {
    if (this.cameraOverride) {
      this.cameraSource = 'override';
      return this.syncViewport(this.cameraOverride);
    }

    const sceneCamera = world.query(Camera).first();
    if (sceneCamera) {
      const camera = sceneCamera.components[0] as Camera;
      // A camera attached to an entity follows that entity's transform.
      if (world.hasComponent(sceneCamera.entity, Transform)) {
        const transform = world.components.get(sceneCamera.entity, Transform);
        if (transform) camera.position.copy(transform.worldPosition);
      }
      this.cameraSource = 'scene';
      return this.syncViewport(camera);
    }

    this.cameraSource = 'fallback';
    return this.syncViewport(this.fallbackCamera);
  }

  private syncViewport(camera: Camera): Camera {
    if (camera.viewportWidth !== this.renderer.width || camera.viewportHeight !== this.renderer.height) {
      camera.setViewport(this.renderer.width, this.renderer.height);
    }
    return camera;
  }

  /** Where the active camera came from - surfaced in diagnostics. */
  get activeCameraSource(): 'override' | 'scene' | 'fallback' {
    return this.cameraSource;
  }

  dispose(): void {
    this.metrics = null;
    this.profiler = null;
  }
}
