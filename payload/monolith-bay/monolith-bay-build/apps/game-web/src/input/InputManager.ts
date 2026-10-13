export interface InputMap {
  moveForward: string[];
  moveBackward: string[];
  moveLeft: string[];
  moveRight: string[];
  interact: string[];
  sprint: string[];
  jump: string[];
  openPhone: string[];
  openMap: string[];
  pause: string[];
  cancel: string[];
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
};

export class InputManager {
  private pressed = new Set<string>();
  private map: InputMap;

  constructor(map: Partial<InputMap> = {}) {
    this.map = { ...DEFAULT_INPUT_MAP, ...map };
  }

  attach(target: Window) {
    target.addEventListener("keydown", (e) => {
      this.pressed.add(e.code);
    });
    target.addEventListener("keyup", (e) => {
      this.pressed.delete(e.code);
    });
    target.addEventListener("blur", () => {
      this.pressed.clear();
    });
  }

  isActionDown(action: keyof InputMap): boolean {
    return this.map[action].some((code) => this.pressed.has(code));
  }
}
