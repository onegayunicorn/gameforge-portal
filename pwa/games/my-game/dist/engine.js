import {
  BrowserDisplayAdapter,
  Engine,
  isGame
} from "./chunk-H2D4S5XG.js";

// runtime/LoadingScreen.ts
var LoadingScreen = class {
  constructor(container, title) {
    this.container = container;
    const panel = document.createElement("div");
    panel.className = "gf-loading";
    this.titleEl = document.createElement("h1");
    this.titleEl.textContent = title;
    this.subtitleEl = document.createElement("p");
    this.subtitleEl.textContent = "Starting engine\u2026";
    const track = document.createElement("div");
    track.className = "gf-track";
    this.fillEl = document.createElement("div");
    this.fillEl.className = "gf-fill";
    track.appendChild(this.fillEl);
    this.detailEl = document.createElement("div");
    this.detailEl.className = "gf-detail";
    panel.append(this.titleEl, this.subtitleEl, track, this.detailEl);
    this.root = panel;
    this.container.appendChild(panel);
  }
  container;
  root;
  titleEl;
  detailEl;
  fillEl;
  subtitleEl;
  setSubtitle(text) {
    this.subtitleEl.textContent = text;
  }
  setTitle(text) {
    this.titleEl.textContent = text;
  }
  /** Update the bar. `ratio` is clamped, so callers may pass raw counts. */
  setProgress(loaded, total, currentId) {
    const ratio = total <= 0 ? 1 : Math.min(1, Math.max(0, loaded / total));
    this.fillEl.style.width = `${Math.round(ratio * 100)}%`;
    this.subtitleEl.textContent = total <= 0 ? "Starting engine\u2026" : `Loading assets ${loaded}/${total}`;
    this.detailEl.textContent = currentId ?? "";
  }
  fail(message) {
    this.subtitleEl.textContent = message;
    this.fillEl.style.width = "100%";
    this.fillEl.style.background = "linear-gradient(90deg, #ff8080, #ff5c7c)";
  }
  hide() {
    this.root.remove();
  }
  get element() {
    return this.root;
  }
};

// runtime/ErrorScreen.ts
var ErrorScreen = class {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    const panel = document.createElement("div");
    panel.className = "gf-error";
    panel.setAttribute("role", "alert");
    const heading = document.createElement("h1");
    heading.textContent = "The game stopped with an error";
    this.phaseEl = document.createElement("div");
    this.phaseEl.className = "gf-phase";
    this.pre = document.createElement("pre");
    this.messageEl = document.createElement("span");
    const actions = document.createElement("div");
    actions.className = "gf-actions";
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Reload";
    reload.addEventListener("click", () => {
      if (this.options.onRetry) this.options.onRetry();
      else window.location.reload();
    });
    this.copyButton = document.createElement("button");
    this.copyButton.type = "button";
    this.copyButton.textContent = "Copy report";
    this.copyButton.addEventListener("click", () => void this.copyReport());
    actions.append(reload, this.copyButton);
    this.hintEl = document.createElement("p");
    this.hintEl.className = "gf-hint";
    if (this.options.hint) this.hintEl.textContent = this.options.hint;
    else this.hintEl.hidden = true;
    this.pre.append(this.messageEl);
    panel.append(heading, this.phaseEl, this.pre, actions, this.hintEl);
    this.root = panel;
    this.container.appendChild(panel);
  }
  container;
  options;
  root;
  messageEl;
  phaseEl;
  hintEl;
  pre;
  copyButton;
  show(error, phase) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.phaseEl.textContent = `phase: ${phase}`;
    this.messageEl.textContent = err.stack ?? `${err.name}: ${err.message}`;
    this.root.hidden = false;
  }
  reportText() {
    return [
      `phase: ${this.phaseEl.textContent ?? "unknown"}`,
      `url: ${window.location.href}`,
      `userAgent: ${navigator.userAgent}`,
      "",
      this.messageEl.textContent ?? ""
    ].join("\n");
  }
  async copyReport() {
    try {
      await navigator.clipboard.writeText(this.reportText());
      this.copyButton.textContent = "Copied";
      setTimeout(() => {
        this.copyButton.textContent = "Copy report";
      }, 1600);
    } catch {
      this.copyButton.textContent = "Copy failed";
    }
  }
  hide() {
    this.root.remove();
  }
  get element() {
    return this.root;
  }
};

// runtime/GameHost.ts
var GameHost = class {
  constructor(options) {
    this.options = options;
  }
  options;
  engineInstance = null;
  game = null;
  loading = null;
  errorScreen = null;
  statusTimer = null;
  unsubscribers = [];
  displayAdapter = null;
  get engine() {
    return this.engineInstance;
  }
  get info() {
    return this.options.info;
  }
  /** The imported game module, once `start()` has resolved it. */
  get gameModule() {
    return this.game;
  }
  setStatus(state, detail) {
    const { status } = this.options.elements;
    status.dataset.state = state;
    status.textContent = detail ? `${state} \xB7 ${detail}` : state;
  }
  async start() {
    const { info, elements } = this.options;
    this.loading = new LoadingScreen(elements.overlay, info.name);
    this.errorScreen = new ErrorScreen(elements.overlay, {
      hint: "Run `npm run game:dev` from this project to rebuild and reload, or use Restart."
    });
    this.errorScreen.element.hidden = true;
    const engine = new Engine({
      canvas: elements.canvas,
      width: info.width,
      height: info.height,
      renderer: info.renderer === "webgl2" ? "auto" : info.renderer,
      debug: info.debug
    });
    this.engineInstance = engine;
    this.displayAdapter = this.options.displayAdapter ?? new BrowserDisplayAdapter({
      canvas: elements.canvas,
      stage: elements.stage,
      logicalWidth: info.width,
      logicalHeight: info.height,
      maxPixelRatio: 2
    });
    this.displayAdapter.attach(engine);
    this.unsubscribers.push(engine.events.on("engine:error", ({ error, phase }) => {
      this.setStatus("error", phase);
      this.loading?.fail("Engine error");
      this.errorScreen?.show(error, phase);
    }));
    this.unsubscribers.push(engine.events.on("asset:progress", ({ loaded, total, id }) => {
      this.loading?.setProgress(loaded, total, id);
    }));
    this.unsubscribers.push(engine.events.on("asset:failed", ({ id, error }) => {
      engine.logger.warn(`asset failed: ${id}`, error.message);
    }));
    this.wireControls(elements);
    try {
      this.setStatus("loading");
      await this.loadAssets(engine);
      const game = await this.importGame(info.entry);
      this.game = game;
      await engine.start(game);
      this.setStatus("running");
      this.loading.hide();
      this.startStateReporting();
      return engine;
    } catch (error) {
      this.setStatus("error");
      this.loading?.fail("Failed to start");
      this.errorScreen?.show(error, "startup");
      throw error;
    }
  }
  async loadAssets(engine) {
    const { manifest } = this.options.info;
    if (!manifest) {
      this.loading?.setProgress(1, 1, "no assets");
      return;
    }
    this.loading?.setSubtitle("Reading asset manifest\u2026");
    await engine.assets.loadManifest(manifest);
    const report = await engine.assets.preloadAll();
    if (report.failed.length > 0) {
      engine.logger.warn(`${report.failed.length} asset(s) failed to load`, report.failed);
      this.loading?.setProgress(report.loaded, report.total, `${report.failed.length} failed`);
    }
  }
  async importGame(entryUrl) {
    const importer = this.options.importGame ?? ((url) => import(
      /* @vite-ignore */
      url
    ));
    const module = await importer(entryUrl);
    if (isGame(module)) return module;
    const fallback = module.default;
    if (isGame(fallback)) return fallback;
    throw new Error(
      `Module ${entryUrl} does not export a game. Expected \`export function setup(engine)\` or a default export.`
    );
  }
  wireControls(elements) {
    elements.restart.addEventListener("click", () => {
      window.location.reload();
    });
    elements.fullscreen.addEventListener("click", () => {
      void (this.displayAdapter?.requestFullscreen() ?? Promise.resolve()).catch(() => void 0);
    });
  }
  startStateReporting() {
    const engine = this.engineInstance;
    if (!engine) return;
    const report = this.options.reportToShell ?? true;
    if (!report) return;
    const tick = () => {
      engine.reportRuntimeState();
      const state = engine.runtimeState();
      const fps = typeof state.fps === "number" ? state.fps : 0;
      const entities = typeof state.entities === "number" ? state.entities : 0;
      this.setStatus(engine.isPaused ? "paused" : "running", `${fps} fps \xB7 ${entities} entities`);
    };
    tick();
    this.statusTimer = window.setInterval(tick, 500);
  }
  async stop() {
    if (this.statusTimer !== null) {
      window.clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    await this.engineInstance?.stop();
    this.displayAdapter?.dispose();
    this.displayAdapter = null;
    this.engineInstance?.dispose();
    this.engineInstance = null;
    this.game = null;
    this.setStatus("booting");
  }
};

// runtime/bootstrap.ts
var OVERLAY_ID = "gameforge-overlay";
function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Runtime shell is missing #${id} (was index.html regenerated?)`);
  return element;
}
function showFatalOverlay(message) {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  overlay.hidden = false;
  const panel = document.createElement("div");
  panel.className = "gf-error";
  panel.setAttribute("role", "alert");
  const heading = document.createElement("h1");
  heading.textContent = "This build could not start";
  const body = document.createElement("pre");
  body.textContent = message;
  panel.append(heading, body);
  overlay.appendChild(panel);
}
async function loadBuildInfo() {
  const injected = globalThis.__GAMEFORGE_GAME__;
  if (injected) return injected;
  const response = await fetch("./game.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load ./game.json (HTTP ${response.status}). Is this the build output directory?`);
  }
  return await response.json();
}
async function boot() {
  const status = requiredElement("gameforge-status");
  status.dataset.state = "booting";
  try {
    const info = await loadBuildInfo();
    document.title = info.name;
    const host = new GameHost({
      info,
      elements: {
        canvas: requiredElement("gameforge-canvas"),
        overlay: requiredElement(OVERLAY_ID),
        status,
        restart: requiredElement("gameforge-restart"),
        fullscreen: requiredElement("gameforge-fullscreen"),
        stage: document.getElementById("gameforge-stage") ?? void 0
      }
    });
    globalThis.gameforgeHost = host;
    await host.start();
    return host;
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    status.dataset.state = "error";
    showFatalOverlay(message);
    console.error("[gameforge] runtime failed to start", error);
    return null;
  }
}
void boot();
export {
  boot
};
//# sourceMappingURL=engine.js.map
