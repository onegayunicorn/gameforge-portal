import { Runtime } from "./runtime/Runtime";
import { createRenderer } from "./renderer/factory";
import { InputManager } from "./input/InputManager";
import { AudioManager } from "./audio/AudioManager";
import { SaveManager } from "./persistence/SaveManager";
import { UIManager } from "./ui/UIManager";
import { loadContentManifest } from "./services/contentManifest";

export async function bootstrap(): Promise<void> {
  const bootStatus = document.getElementById("boot-status");
  const progressBar = document.getElementById("boot-progress-bar");

  const setProgress = (pct: number, label: string) => {
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (bootStatus) bootStatus.textContent = label;
  };

  setProgress(5, "Loading environment configuration&hellip;");
  const env = loadEnvironment();

  setProgress(15, "Initializing logger and diagnostics&hellip;");
  const logger = createLogger(env.logLevel);

  setProgress(25, "Registering service worker&hellip;");
  if ("serviceWorker" in navigator && env.appEnv === "production") {
    await navigator.serviceWorker.register("/sw.js").catch((e) => {
      logger.warn("Service worker registration failed:", e);
    });
  }

  setProgress(40, "Loading content manifest&hellip;");
  const contentManifest = await loadContentManifest(env.contentManifestUrl);

  setProgress(55, "Opening persistence layer&hellip;");
  const saveManager = new SaveManager();
  await saveManager.initialize();

  setProgress(65, "Loading user settings&hellip;");
  const settings = await saveManager.loadSettings();

  setProgress(75, "Initializing input system&hellip;");
  const inputManager = new InputManager(settings.input);
  inputManager.attach(window);

  setProgress(82, "Initializing audio&hellip;");
  const audioManager = new AudioManager(settings.audio);

  setProgress(90, "Initializing renderer&hellip;");
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const renderer = await createRenderer(canvas, settings.graphics);

  setProgress(95, "Starting runtime&hellip;");
  const runtime = new Runtime({
    env,
    logger,
    contentManifest,
    saveManager,
    settings,
    inputManager,
    audioManager,
    renderer,
  });

  const uiManager = new UIManager(document.getElementById("ui-layer")!, runtime);
  runtime.setUIManager(uiManager);

  setProgress(100, "Ready.");
  document.getElementById("boot-screen")?.setAttribute("hidden", "");
  document.getElementById("game-shell")?.removeAttribute("hidden");

  runtime.start();
}

function loadEnvironment() {
  return {
    appEnv: (import.meta.env.VITE_APP_ENV as string) ?? "development",
    appVersion: (import.meta.env.VITE_APP_VERSION as string) ?? "0.1.0",
    contentVersion: (import.meta.env.VITE_CONTENT_VERSION as string) ?? "0.1.0",
    contentManifestUrl:
      (import.meta.env.VITE_CONTENT_MANIFEST_URL as string) ?? "/content/manifests/development.json",
    logLevel: (import.meta.env.VITE_LOG_LEVEL as string) ?? "info",
    enableTelemetry: (import.meta.env.VITE_ENABLE_TELEMETRY as string) === "true",
  };
}

function createLogger(level: string) {
  const levels = ["debug", "info", "warn", "error"];
  const minLevel = levels.indexOf(level);
  return {
    debug: (...args: unknown[]) => minLevel <= 0 && console.debug("[MB]", ...args),
    info: (...args: unknown[]) => minLevel <= 1 && console.info("[MB]", ...args),
    warn: (...args: unknown[]) => minLevel <= 2 && console.warn("[MB]", ...args),
    error: (...args: unknown[]) => minLevel <= 3 && console.error("[MB]", ...args),
  };
}
