# GameForge third-party SDK foundation (development)

This tranche adds typed public contracts, a fetch-based client, strict app-manifest validation, a JSON Schema, OpenAPI documentation, and a loopback-only **read-only** development API.

## Run and validate

```sh
npm ci
npm run verify
npm run sdk:typecheck
npm run sdk:test
npm run api:test
npm run schema:validate
node services/api/server.mjs
```

The API listens on `127.0.0.1:8787`. Available routes are `GET /health`, `GET /v1/capabilities`, `GET /v1/catalog/games`, and `GET /v1/catalog/games/hello-render`. The OpenAPI document is `openapi/gameforge-v1.yaml`. CI separately runs the engine/game smoke suite and a Windows job for the PWA audit and Windows desktop packaging. The manifest validator rejects malformed URLs and unknown capabilities, clients, and game modes.

## Boundaries

This is not a production identity provider, real catalog database, creator backend, host agent, WebRTC stream, or cross-play implementation. Unimplemented routes return `501`; mutation methods return `405`. No remote bind, production credentials, remote execution, or plugin privileges are enabled. The existing Electron/PWA application is unchanged.

## Follow-on gates

1. Design authentication and authorize individual scopes with OIDC PKCE; enforce permissions server-side.
2. Replace the demo catalog with a verified game-index adapter and contract tests.
3. Implement creator/project APIs with isolation and artifact verification.
4. Implement authenticated sessions and WebRTC signaling behind explicit feature flags and manual release approval.
5. Add plugin sandboxing, telemetry redaction, and integration/E2E test coverage.
6. Require reviewed release and staging verification before production.
