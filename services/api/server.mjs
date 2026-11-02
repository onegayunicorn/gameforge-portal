import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const games = Object.freeze([{ id: "hello-render", name: "Hello Render", description: "Bundled demonstration game" }]);

function bearerToken(req) {
  const value = req.headers.authorization;
  if (typeof value !== "string" || !value.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

export function createApiServer({ authEnabled = false, sessionStore = null, oidcProvider = null } = {}) {
  const enabled = authEnabled === true;
  return createServer((req, res) => {
    let path;
    try { path = new URL(req.url ?? "/", "http://localhost").pathname; }
    catch { res.writeHead(400).end(); return; }
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "GET") return send(405, { error: "method_not_allowed" });
    if (path === "/health") return send(200, { status: "ok", mode: enabled ? "development-auth-enabled" : "read-only-development" });
    if (path === "/v1/auth/config") {
      if (!enabled || !oidcProvider) return send(501, { error: "not_implemented", message: "External authentication is not enabled" });
      return send(200, { issuer: oidcProvider.issuer, clientId: oidcProvider.clientId, redirectUri: oidcProvider.redirectUri, scopes: oidcProvider.scopes });
    }
    if (path === "/v1/capabilities") return send(200, { apiVersion: "1.0.0", supported: ["catalog.read"], denied: ["session.create", "stream.connect", "host.manage"], runtimeModes: ["browser"] });
    if (path === "/v1/session") {
      if (!enabled || !sessionStore) return send(501, { error: "not_implemented", message: "Authenticated sessions are not enabled" });
      const session = sessionStore.get(bearerToken(req));
      return session ? send(200, session) : send(401, { error: "unauthorized" });
    }
    if (path === "/v1/catalog/games") return send(200, { items: games, page: 1, pageSize: games.length, total: games.length });
    if (path.startsWith("/v1/catalog/games/")) {
      let id;
      try { id = decodeURIComponent(path.slice("/v1/catalog/games/".length)); }
      catch { return send(400, { error: "invalid_path_encoding" }); }
      const game = games.find((item) => item.id === id);
      return game ? send(200, game) : send(404, { error: "not_found" });
    }
    return send(501, { error: "not_implemented", message: "Protected or remote functionality is not enabled" });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.GAMEFORGE_API_PORT ?? 8787);
  createApiServer({ authEnabled: process.env.GAMEFORGE_AUTH_ENABLED === "1" }).listen(port, "127.0.0.1", () => console.log("GameForge development API on loopback port " + port));
}
