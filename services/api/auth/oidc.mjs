import { createHash, randomBytes } from "node:crypto";

const DEFAULT_SCOPES = Object.freeze(["openid", "profile", "email"]);

function requireHttpsUrl(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${name} must be a valid URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new TypeError(`${name} must be an HTTPS URL without credentials`);
  }
  return parsed;
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function hash(value) {
  return createHash("sha256").update(value).digest("base64url");
}

/**
 * Creates a fixed-issuer OIDC client boundary. Discovery and token exchange are
 * intentionally supplied by a host integration; this module never accepts an
 * arbitrary issuer from a request.
 */
export function createOidcProvider({ issuer, clientId, redirectUri, authorizationEndpoint, scopes = DEFAULT_SCOPES }) {
  const issuerUrl = requireHttpsUrl(issuer, "issuer");
  const redirect = requireHttpsUrl(redirectUri, "redirectUri");
  const authorization = requireHttpsUrl(authorizationEndpoint, "authorizationEndpoint");
  if (typeof clientId !== "string" || clientId.trim() === "") throw new TypeError("clientId is required");
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((scope) => typeof scope !== "string" || !/^[a-z][a-z0-9:_-]*$/.test(scope))) {
    throw new TypeError("scopes must be non-empty OIDC scope names");
  }

  const fixedIssuer = issuerUrl.origin + issuerUrl.pathname.replace(/\/$/, "");
  return Object.freeze({
    issuer: fixedIssuer,
    clientId,
    redirectUri: redirect.href,
    scopes: Object.freeze([...new Set(scopes)]),
    beginAuthorization({ state = base64Url(randomBytes(24)), codeVerifier = base64Url(randomBytes(32)) } = {}) {
      if (!/^[A-Za-z0-9_-]{22,}$/.test(state) || !/^[A-Za-z0-9_-]{32,}$/.test(codeVerifier)) throw new TypeError("state and codeVerifier must be high-entropy base64url values");
      const url = new URL(authorization);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirect.href);
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", hash(codeVerifier));
      url.searchParams.set("code_challenge_method", "S256");
      return Object.freeze({ url: url.href, state, codeVerifier });
    },
    assertIssuer(value) {
      return value === fixedIssuer;
    },
  });
}

/** Normalize only the stable identity claims needed by GameForge. */
export function normalizeOidcClaims(claims, { issuer, audience } = {}) {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) throw new TypeError("OIDC claims must be an object");
  if (typeof claims.sub !== "string" || claims.sub.trim() === "") throw new TypeError("OIDC sub claim is required");
  if (issuer !== undefined && claims.iss !== issuer) throw new TypeError("OIDC issuer mismatch");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audience !== undefined && !audiences.includes(audience)) throw new TypeError("OIDC audience mismatch");
  return Object.freeze({
    subject: claims.sub,
    issuer: typeof claims.iss === "string" ? claims.iss : undefined,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
  });
}
