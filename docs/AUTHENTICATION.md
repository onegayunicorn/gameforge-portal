# GameForge authentication boundary

This tranche adds a provider-neutral identity boundary without turning on external authentication.

## Defaults

- `GAMEFORGE_AUTH_ENABLED` is **off** unless the process is explicitly started with `1`.
- The API continues to bind to `127.0.0.1`.
- Catalog reads remain public and read-only.
- Session creation, remote sessions, creator builds, streaming, and host control remain unimplemented and fail closed.
- No issuer, client secret, access token, or ID token is accepted from an HTTP request.

## OIDC boundary

`services/api/auth/oidc.mjs` accepts a fixed HTTPS issuer, client id, redirect URI, and authorization endpoint from host configuration. It creates authorization requests using PKCE S256 and a caller-supplied or generated high-entropy state and verifier. The host integration is responsible for discovery, code exchange, and ID-token signature verification against the configured issuer; this repository does not silently implement those security-critical network operations.

OIDC claims are reduced to the stable fields GameForge needs (`subject`, `issuer`, `email`, and `name`). Issuer and audience checks are available at the normalization boundary and must be enforced before a session is created.

## Local sessions

`services/api/auth/sessions.mjs` uses Node's built-in `node:sqlite` support. It stores only SHA-256 digests of random opaque bearer tokens, together with the subject, scopes, issue time, expiry, and optional revocation time. `createSessionStore()` defaults to an in-memory database; a host can provide a file path for local development persistence.

The store provides:

- bounded-lifetime session creation;
- constant-time token digest comparison;
- expiry and explicit revocation;
- purge of expired/revoked rows.

The API's `/v1/session` read endpoint is only available when both `authEnabled: true` and a session store are passed to `createApiServer()`. A missing or invalid bearer token returns `401`; disabled configuration returns `501`.

## Verification

```sh
npm run api:test
```

The auth tests cover fixed-issuer PKCE construction, issuer/audience mismatch rejection, normalized claims, session expiry/revocation, and the disabled-by-default API boundary.
