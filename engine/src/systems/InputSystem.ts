import { Camera } from '../renderer/Camera';
import { SystemPriority } from '../core/System';
import type { System } from '../core/System';
import type { World } from '../core/World';
import type { Input } from '../input/Input';

/**
 * Keeps the input layer pointed at the active camera.
 *
 * Pointer positions arrive in pixels; converting them to world space needs the camera, and the
 * camera can change (scene transition, camera swap, follow target). Doing that wiring in a system
 * means game code can call `input.pointerWorld()` at any point in the frame and get the right
 * answer, without every game remembering to keep the reference in sync.
 */
export class InputSystem implements System {
  readonly name = 'InputSystem';
  readonly priority = SystemPriority.Input;

  private input: Input | null = null;

  initialize(world: World): void {
    this.input = (world.services as { input?: Input | null }).input ?? null;
    this.syncCamera(world);
  }

  update(world: World): void {
    this.syncCamera(world);
  }

  private syncCamera(world: World): void {
    if (!this.input) return;
    const explicit = (world.services as { camera?: Camera | null }).camera ?? null;
    this.input.camera = explicit ?? InputSystem.findSceneCamera(world);
  }

  /** First Camera component in the active scene, used when no camera was supplied explicitly. */
  private static findSceneCamera(world: World): Camera | null {
    const match = world.query(Camera).first();
    return match ? (match.components[0] as Camera) : null;
  }
}
