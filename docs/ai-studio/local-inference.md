# Local AI Studio: models and runtime

GameForge Studio uses WebLLM `0.2.86` for browser-local inference through WebGPU. It calls no hosted inference API and needs no OpenAI, Anthropic, or other API key. The selected runtime and model IDs are pinned in `package.json` and `portal/studio/models.json`.

## Available models

The Studio exposes these prebuilt MLC models from the WebLLM `0.2.86` registry:

- **Gemma 3 1B Instruct, q4f16** — `gemma3-1b-it-q4f16_1-MLC`; registry estimate 711.07 MB VRAM; 4,096-token context. This is the default small model.
- **Llama 3.2 1B Instruct, q4f16** — `Llama-3.2-1B-Instruct-q4f16_1-MLC`; registry estimate 879.04 MB VRAM; 4,096-token context.
- **Qwen3 0.6B, q4f16** — `Qwen3-0.6B-q4f16_1-MLC`; registry estimate 1,403.34 MB VRAM; 4,096-token context.

These are registry VRAM estimates, not download sizes or guarantees that a specific graphics driver can allocate the model. Actual startup and generation speed depend on browser, GPU, and available memory. The first model load downloads its preconverted model weights and WebGPU library. A WebGPU-capable browser and a secure origin (HTTPS or localhost) are required.

## Network, privacy, and storage

Prompts and generated content are sent to the WebLLM worker in the current page and are not sent to an inference service. The only network access used by inference is fetching the selected model artifacts from Hugging Face and the WebLLM model-library host. WebLLM uses the browser Cache API by default. Browser storage is origin-specific and can be evicted or cleared; after a successful initial download, cached artifacts can support offline inference while they remain available. Refreshing the page clears the in-memory conversation; the Studio does not save prompts or generated files unless the user downloads them.

The PWA service worker precaches the Studio code separately and only deletes old caches with the `gameforge-pwa-` prefix. It preserves WebLLM's model cache.

## Generated output and preview safety

A local generation returns two downloadable text artifacts: `sim.json` and `game.ts`. The JSON is checked against bounded dimensions, entity counts, finite numeric values, and an allowlist of Canvas2D object types before being rendered by the built-in preview. The TypeScript is displayed as text and is never evaluated by the Studio. No external game libraries, scripts, or CDNs are permitted in the generated-code instructions.

## Build and release details

The WebLLM worker build keeps legal comments inline and writes `portal/studio/THIRD-PARTY-LICENSES.txt` with the WebLLM Apache-2.0 and bundled `loglevel` MIT notices; the Studio notes page links to the generated notices. GitHub workflow JavaScript actions use `actions/checkout@v5` and `actions/setup-node@v5` (Node 24 action runtimes; the project itself remains on Node 22). The release workflow now publishes with the runner's `gh release create` CLI rather than the Node 20-based `softprops/action-gh-release` action.

## Sources

[1]: https://webllm.mlc.ai/docs/ "WebLLM documentation"
[2]: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts "WebLLM prebuilt model registry"
[3]: https://web.dev/articles/ai-chatbot-webllm "Build a local and offline-capable chatbot with WebLLM"
[4]: https://raw.githubusercontent.com/actions/checkout/v5/action.yml "actions/checkout v5 action metadata"
[5]: https://raw.githubusercontent.com/actions/setup-node/v5/action.yml "actions/setup-node v5 action metadata"
