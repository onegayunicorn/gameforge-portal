// @monolith/renderer
// Renderer abstraction with WebGL2 implementation and WebGPU-ready API.

export type GraphicsPreset = "low" | "medium" | "high" | "ultra" | "custom";

export interface GraphicsSettings {
  preset: GraphicsPreset;
  resolutionScale: number;
  shadows: "off" | "low" | "medium" | "high";
  ambientOcclusion: boolean;
  reflections: "off" | "low" | "high";
  bloom: boolean;
  depthOfField: boolean;
  motionBlur: boolean;
  particles: "low" | "medium" | "high";
  textureQuality: "low" | "medium" | "high";
  antiAliasing: "none" | "fxaa" | "msaa";
  maxFps: 30 | 60 | 120 | 0;
}

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  preset: "medium",
  resolutionScale: 1.0,
  shadows: "medium",
  ambientOcclusion: true,
  reflections: "low",
  bloom: true,
  depthOfField: false,
  motionBlur: false,
  particles: "medium",
  textureQuality: "medium",
  antiAliasing: "fxaa",
  maxFps: 60,
};

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

export interface SceneAsset {
  id: string;
  geometry: unknown;
  materials: unknown[];
  lights: unknown[];
  navMesh?: unknown;
}

export interface Renderer {
  initialize(canvas: HTMLCanvasElement): Promise<void>;
  loadScene(scene: SceneAsset): Promise<void>;
  unloadScene(sceneId: string): void;
  setQualityPreset(preset: GraphicsPreset): void;
  setCamera(camera: CameraState): void;
  render(alpha: number): void;
  dispose(): void;
}

export function detectRendererBackend(): "webgl2" | "webgpu" | "none" {
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    return "webgpu";
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    if (canvas.getContext("webgl2")) return "webgl2";
  }
  return "none";
}
