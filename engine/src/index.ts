/**
 * GameForge Engine public API.
 *
 * `export type` is used for interfaces so a consumer's bundler can tree-shake aggressively; the
 * values exported below are the only runtime surface a game needs.
 */

/* ---------------------------------------------------------------- core */
export { Engine } from './core/Engine';
export type { EngineOptions } from './core/Engine';
export { World } from './core/World';
export type { WorldOptions, WorldServices } from './core/World';
export { Scene } from './core/Scene';
export { Entity } from './core/Entity';
export type { EntityId } from './core/Entity';
export { componentHooks, componentTypeName } from './core/Component';
export type { Component, ComponentClass, ComponentHooks } from './core/Component';
export { compareSystems, SystemPriority } from './core/System';
export type { System } from './core/System';
export { Clock } from './core/Clock';
export { GameLoop } from './core/GameLoop';
export type { GameLoopOptions, GameLoopCallbacks, GameLoopStats } from './core/GameLoop';
export { resolveEngineConfig } from './core/EngineConfig';
export type { EngineConfig, ResolvedEngineConfig, RendererPreference, RendererBackend } from './core/EngineConfig';
export { EventBus } from './core/EventBus';
export type { EventMap, EventHandler } from './core/EventBus';
export type { EngineEvents } from './core/EngineEvents';
export { GameBase, isGame } from './core/Game';
export type { Game } from './core/Game';

/* ---------------------------------------------------------------- ecs */
export { EntityManager } from './ecs/EntityManager';
export { ComponentStore } from './ecs/ComponentStore';
export { Query } from './ecs/Query';
export type { QueryMatch } from './ecs/Query';

/* ---------------------------------------------------------------- math */
export { Vector2 } from './math/Vector2';
export { Rectangle } from './math/Rectangle';
export { Color } from './math/Color';
export * as MathUtils from './math/MathUtils';

/* ---------------------------------------------------------------- scene */
export { Transform } from './scene/Transform';

/* ---------------------------------------------------------------- renderer */
export { BaseRenderer } from './renderer/Renderer';
export type { Renderer, RendererCapabilities, BeginFrameOptions } from './renderer/Renderer';
export { Canvas2DRenderer } from './renderer/Canvas2DRenderer';
export type { Canvas2DRendererOptions } from './renderer/Canvas2DRenderer';
export { Camera } from './renderer/Camera';
export type { CameraFollowOptions } from './renderer/Camera';
export { RenderQueue } from './renderer/RenderQueue';
export { Sprite } from './renderer/Sprite';
export type { SpriteOptions } from './renderer/Sprite';
export { Material } from './renderer/Material';
export type { MaterialOptions, BlendMode } from './renderer/Material';
export { Texture } from './renderer/Texture';
export type { TextureSource } from './renderer/Texture';
export type { DrawCommand, QuadCommand, CircleCommand, LineCommand, RenderStats } from './renderer/RenderContext';
export { quad, rect } from './renderer/primitives/Quad';
export { circle, ring } from './renderer/primitives/Circle';
export { line } from './renderer/primitives/Line';

/* ---------------------------------------------------------------- assets */
export { AssetManager } from './assets/AssetManager';
export type { AssetLoader, AssetManagerOptions, AssetProgress, PreloadReport } from './assets/AssetManager';
export { AssetHandle } from './assets/AssetHandle';
export type { AssetState } from './assets/AssetHandle';
export { AssetCache } from './assets/cache/AssetCache';
export {
  ASSET_MANIFEST_VERSION,
  createAssetManifest,
  findManifestEntry,
  parseAssetManifest,
  validateAssetManifest,
} from './assets/AssetManifest';
export type { AssetManifest, AssetManifestEntry, AssetType } from './assets/AssetManifest';
export { TextureLoader } from './assets/loaders/TextureLoader';
export { JsonLoader } from './assets/loaders/JsonLoader';
export { TextLoader } from './assets/loaders/TextLoader';

/* ---------------------------------------------------------------- input */
export { Input } from './input/Input';
export type { InputAttachOptions } from './input/Input';
export { Keyboard } from './input/Keyboard';
export { Mouse } from './input/Mouse';
export type { MouseAttachOptions } from './input/Mouse';
export { Touch } from './input/Touch';
export type { TouchPoint, TouchAttachOptions } from './input/Touch';
export { InputMap } from './input/InputMap';
export type { Binding, AxisBinding, BindingSource } from './input/InputMap';

/* ---------------------------------------------------------------- scripting */
export { Script } from './scripting/Script';
export {
  invokeOnDestroy,
  invokeOnEnabledChanged,
  invokeOnStart,
  invokeOnUpdate,
  scriptLabel,
} from './scripting/Lifecycle';
export type { LifecycleErrorHandler, LifecycleOptions } from './scripting/Lifecycle';

/* ---------------------------------------------------------------- systems */
export { TransformSystem } from './systems/TransformSystem';
export { RenderSystem } from './systems/RenderSystem';
export type { RenderSystemOptions } from './systems/RenderSystem';
export { ScriptSystem } from './systems/ScriptSystem';
export type { ScriptSystemOptions } from './systems/ScriptSystem';
export { InputSystem } from './systems/InputSystem';

/* ---------------------------------------------------------------- diagnostics */
export { Logger, isLogEnabled } from './diagnostics/Logger';
export type { LogEntry, LogLevel, LogSink, LoggerOptions } from './diagnostics/Logger';
export { Metrics } from './diagnostics/Metrics';
export type { MetricsSnapshot } from './diagnostics/Metrics';
export { Profiler } from './diagnostics/Profiler';
export type { ProfileSection } from './diagnostics/Profiler';
export { DebugDraw } from './diagnostics/DebugDraw';

/* ---------------------------------------------------------------- platform */
export { detectPlatformKind } from './platform/Platform';
export type { Platform, PlatformInfo, PlatformKind } from './platform/Platform';
export { BrowserPlatform, HeadlessPlatform } from './platform/BrowserPlatform';
export { ElectronPlatform } from './platform/ElectronPlatform';
export type { RuntimeReporter } from './platform/ElectronPlatform';

/* ---------------------------------------------------------------- display */
export { BrowserDisplayAdapter } from './display/DisplayAdapter';
export type { DisplayAdapter, DisplayViewport, BrowserDisplayAdapterOptions } from './display/DisplayAdapter';
