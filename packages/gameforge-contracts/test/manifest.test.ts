import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../src/index.js";
import { createGameForgeClient } from "../../gameforge-app-sdk/src/index.js";

const validManifest = {
  appId: "com.example.portal",
  name: "Example Portal",
  version: "1.0.0",
  publisher: "Example Studio",
  callbackUrls: ["https://example.com/auth/callback"],
  requestedCapabilities: ["catalog.read"],
  supportedClients: ["web"],
  supportedGameModes: ["browser"],
  sdkVersion: "1.0.0",
};

test("accepts a well-formed manifest", () => {
  assert.equal(validateManifest(validManifest), true);
});

test("rejects malformed values and unrecognized capabilities", () => {
  const invalidCases: unknown[] = [
    null,
    [],
    { ...validManifest, appId: "" },
    { ...validManifest, version: "not-semver" },
    { ...validManifest, callbackUrls: [] },
    { ...validManifest, callbackUrls: ["https://"] },
    { ...validManifest, callbackUrls: ["http://example.com/callback"] },
    { ...validManifest, callbackUrls: ["https://user:pass@example.com/callback"] },
    { ...validManifest, requestedCapabilities: ["root.access"] },
    { ...validManifest, supportedClients: ["unknown-client"] },
    { ...validManifest, supportedGameModes: ["shell"] },
    { ...validManifest, supportedClients: [] },
    { ...validManifest, callbackUrls: ["https://example.com/cb", "https://example.com/cb"] },
    { ...validManifest, homepage: "javascript:alert(1)" },
    { ...validManifest, unexpected: "extra-field" },
  ];
  for (const sample of invalidCases) assert.equal(validateManifest(sample), false, JSON.stringify(sample));
});

test("client rejects a manifest it cannot validate", () => {
  assert.throws(() => createGameForgeClient({ baseUrl: "https://api.example.com", appManifest: { ...validManifest, requestedCapabilities: ["root.access"] } as never }), /Invalid app manifest/);
});

test("client allows HTTPS and loopback HTTP only", () => {
  assert.doesNotThrow(() => createGameForgeClient({ baseUrl: "https://api.example.com", appManifest: validManifest }));
  assert.doesNotThrow(() => createGameForgeClient({ baseUrl: "http://127.0.0.1:8787", appManifest: validManifest }));
  assert.throws(() => createGameForgeClient({ baseUrl: "http://192.168.1.2:8787", appManifest: validManifest }), /requires HTTPS/);
});
