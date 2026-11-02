import type { AppCapability, CapabilityNegotiation, CatalogPage, GameForgeAppManifest, GameSummary } from "../../gameforge-contracts/src/index.js";
import { validateManifest } from "../../gameforge-contracts/src/index.js";
export interface GameForgeClientOptions { baseUrl: string; appManifest: GameForgeAppManifest; getAccessToken?: () => Promise<string | null> }
export class GameForgeApiError extends Error { constructor(readonly status: number, message: string) { super(message); this.name = "GameForgeApiError"; } }
export function createGameForgeClient(options: GameForgeClientOptions) {
  if (!validateManifest(options.appManifest)) throw new Error("Invalid app manifest: HTTPS callbacks required");
  const origin = new URL(options.baseUrl);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(origin.hostname))) throw new Error("GameForge requires HTTPS except loopback development");
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getAccessToken?.();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", "Bearer " + token);
    const response = await fetch(new URL(path.replace(/^\//,""), origin.href.replace(/\/?$/,"/")), { ...init, headers, credentials:"omit", redirect:"error" });
    if (!response.ok) throw new GameForgeApiError(response.status, "GameForge request failed (" + response.status + ")");
    return response.json() as Promise<T>;
  }
  return {
    negotiate: () => request<CapabilityNegotiation>("/v1/capabilities"),
    portal: {
      getHome: () => request<{ featured: GameSummary[]; recentlyPlayed: GameSummary[]; favorites: GameSummary[]; recommendations: GameSummary[]; activeSessions: unknown[] }>("/v1/portal/home"),
      search: (input: { query: string; page?: number; pageSize?: number }) => request<CatalogPage>("/v1/catalog/games?" + new URLSearchParams({query:input.query,page:String(input.page??1),pageSize:String(input.pageSize??20)})),
      getGame: (id: string) => request<GameSummary>("/v1/catalog/games/" + encodeURIComponent(id))
    },
    library: { list: () => request<{items:GameSummary[]}>("/v1/library") },
    runtime: { getSession: (id: string) => request<unknown>("/v1/sessions/" + encodeURIComponent(id)) },
    grantedCapabilities: async (): Promise<AppCapability[]> => (await request<CapabilityNegotiation>("/v1/capabilities")).supported
  };
}
