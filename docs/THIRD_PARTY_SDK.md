# GameForge third-party SDK foundation (development)
This tranche adds typed public contracts, a fetch-based client, manifest JSON Schema, OpenAPI documentation and a loopback-only **read-only** development API.

## Run
```sh
node --test services/api/test/*.test.mjs
node services/api/server.mjs
```
The API listens on 127.0.0.1:8787. GET /health, /v1/capabilities, /v1/catalog/games and /v1/catalog/games/hello-render are available.

## Boundaries
This is not a production identity provider, real catalog database, creator backend, host agent, WebRTC stream, or cross-play implementation. Unimplemented routes return 501; mutation methods return 405. No remote bind, production credentials, remote execution, or plugin privileges are enabled. The existing Electron/PWA application is unchanged.

## Follow-on gates
1. Authenticate and authorize individual scopes with OIDC PKCE; enforce permissions server-side.
2. Replace demo catalog with verified game index adapter and contract tests.
3. Implement creator/project API with isolation and artifact verification.
4. Implement authenticated sessions and WebRTC signaling behind manual approval.
5. Add plugin sandbox, telemetry redaction, and integration/E2E test coverage.
6. Require reviewed release and staging verification before production.
