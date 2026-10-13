import type { Renderer, GraphicsSettings, GraphicsPreset } from "@monolith/renderer";

export async function createRenderer(
  canvas: HTMLCanvasElement,
  settings: GraphicsSettings,
): Promise<Renderer> {
  const gl = canvas.getContext("webgl2", {
    antialias: settings.antiAliasing !== "none",
    alpha: false,
    powerPreference: "high-performance",
  });

  if (!gl) {
    throw new Error("WebGL2 is not supported by this browser.");
  }

  // WebGL2 renderer implementation would be initialized here.
  // This scaffold returns a minimal renderer interface.
  const renderer: Renderer = {
    async initialize() {
      resizeCanvas(canvas);
      window.addEventListener("resize", () => resizeCanvas(canvas));
    },
    async loadScene() {},
    unloadScene() {},
    setQualityPreset(_preset: GraphicsPreset) {},
    setCamera() {},
    render(_alpha: number) {
      gl.clearColor(0.06, 0.07, 0.11, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };

  await renderer.initialize();
  return renderer;
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}
