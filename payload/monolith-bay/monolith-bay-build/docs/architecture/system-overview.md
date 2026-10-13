# System Overview
Monolith Bay is a browser-first HTML5/WebGL monorepo.
- Runtime: TypeScript, fixed-step game loop, interpolated rendering.
- Renderer: WebGL2 primary, WebGPU-ready abstraction.
- UI: HTML/CSS layer over 3D canvas.
- Persistence: IndexedDB with atomic saves and rotating backups.
- Content: data-driven JSON manifests with provenance validation.
