// @monolith/input-system
// Input mapping, keyboard/mouse/controller support, remapping.

export type InputAction =
  | "moveForward"
  | "moveBackward"
  | "moveLeft"
  | "moveRight"
  | "interact"
  | "sprint"
  | "jump"
  | "openPhone"
  | "openMap"
  | "pause"
  | "cancel"
  | "confirm"
  | "cycleApp"
  | "cameraLeft"
  | "cameraRight";

export interface InputMap {
  [action: string]: string[];
}

export const DEFAULT_INPUT_MAP: InputMap = {
  moveForward: ["KeyW", "ArrowUp"],
  moveBackward: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],
  interact: ["KeyE"],
  sprint: ["ShiftLeft", "ShiftRight"],
  jump: ["Space"],
  openPhone: ["KeyP", "Escape"],
  openMap: ["KeyM"],
  pause: ["Escape"],
  cancel: ["Escape", "Backspace"],
  confirm: ["Enter", "Space"],
  cycleApp: ["Tab"],
  cameraLeft: ["ArrowLeft"],
  cameraRight: ["ArrowRight"],
};

export class InputSystem {
  private pressed = new Set<string>();
  private justPressed = new Set<string>();
  private map: InputMap;
  private listeners = new Map<InputAction, Array<() => void>>();

  constructor(map: InputMap = DEFAULT_INPUT_MAP) {
    this.map = { ...DEFAULT_INPUT_MAP, ...map };
  }

  attach(target: Window) {
    target.addEventListener("keydown", (e) => {
      if (!this.pressed.has(e.code)) {
        this.justPressed.add(e.code);
        this.fireActionListeners(e.code);
      }
      this.pressed.add(e.code);
    });
    target.addEventListener("keyup", (e) => {
      this.pressed.delete(e.code);
    });
    target.addEventListener("blur", () => {
      this.pressed.clear();
      this.justPressed.clear();
    });
  }

  private fireActionListeners(code: string) {
    for (const [action, codes] of Object.entries(this.map)) {
      if (codes.includes(code)) {
        this.listeners.get(action as InputAction)?.forEach((fn) => fn());
      }
    }
  }

  onAction(action: InputAction, fn: () => void) {
    if (!this.listeners.has(action)) this.listeners.set(action, []);
    this.listeners.get(action)!.push(fn);
  }

  isDown(action: InputAction): boolean {
    return this.map[action]?.some((code) => this.pressed.has(code)) ?? false;
  }

  wasJustPressed(action: InputAction): boolean {
    const result = this.map[action]?.some((code) => this.justPressed.has(code)) ?? false;
    return result;
  }

  endFrame() {
    this.justPressed.clear();
  }

  remap(action: InputAction, codes: string[]) {
    this.map[action] = codes;
  }

  getMap(): InputMap {
    return { ...this.map };
  }
}
