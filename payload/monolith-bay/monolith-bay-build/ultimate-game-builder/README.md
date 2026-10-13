# Ultimate Game Engine Builder

A unified project schema, visual editor, asset pipeline, plugin SDK, and build orchestration system with multiple runtime targets and external engine adapters.

## Architecture

- **Canonical project model**: engine-neutral data representation
- **Studio UI**: visual editor (scene, entity, material, animation, UI, quest, dialogue editors)
- **Builder CLI**: project generation and build orchestration
- **Native runtimes**: WebGL2, WebGPU, WASM, native Rust/C++
- **External adapters**: Godot, Unity, Unreal, Bevy, Babylon.js, Three.js, PlayCanvas, Blender, O3DE, Defold, Cocos, Stride, MonoGame, Phaser
- **Build graph**: task scheduler with caching and capability registry

Engines are treated as runtime providers or export targets, never merged into a single runtime.
