import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createOidcProvider, normalizeOidcClaims } from "../auth/oidc.mjs";
import { createSessionStore } from "../auth/sessions.mjs";
import { createApiServer } from "../server.mjs";

test("OIDC provider creates fixed-issuer S256 PKCE requests", () => {
  const provider = createOidcProvider({
    issuer: "https://id.example.test/issuer/",
    clientId: "gameforge-dev",
    redirectUri: "https://portal.example.test/auth/callback",
    authorizationEndpoint: "https://id.example.test/authorize",
  });
  const request = provider.beginAuthorization({ state: "state_1234567890123456789012", codeVerifier: "verifier_123456789012345678901234567890" });
  const url = new URL(request.url);
  assert.equal(provider.issuer, "https://id.example.test/issuer");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("client_id"), "gameforge-dev");
  assert.equal(provider.assertIssuer("https://other.example.test"), false);
});

test("OIDC claims are normalized and issuer/audience mismatches fail", () => {
  assert.deepEqual(normalizeOidcClaims({ iss: "https://id.example.test", aud: ["client"], sub: "user-1", email: "user@example.test" }, { issuer: "https://id.example.test", audience: "client" }), {
    subject: "user-1", issuer: "https://id.example.test", email: "user@example.test", name: undefined,
  });
  assert.throws(() => normalizeOidcClaims({ iss: "https://evil.example.test", aud: "client", sub: "user-1" }, { issuer: "https://id.example.test", audience: "client" }), /issuer mismatch/);
});

test("session store persists only hashed opaque tokens and enforces expiry/revocation", () => {
  let clock = 1000;
  const store = createSessionStore({ ttlMs: 100, now: () => clock });
  const created = store.create({ subject: "user-1", scopes: ["profile.read", "profile.read"] });
  assert.match(created.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.deepEqual(store.get(created.token), { subject: "user-1", scopes: ["profile.read"], createdAt: 1000, expiresAt: 1100 });
  assert.equal(store.get("not-a-token"), null);
  assert.equal(store.revoke(created.token), true);
  assert.equal(store.get(created.token), null);
  const second = store.create({ subject: "user-2" });
  clock = 1200;
  assert.equal(store.get(second.token), null);
  assert.equal(store.purge(), 2);
  store.close();
});

test("API auth remains disabled unless explicitly configured", async () => {
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/v1/auth/config`)).status, 501);
    assert.equal((await fetch(`${base}/v1/session`)).status, 501);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
