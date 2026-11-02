export const API_VERSION = "1.0.0" as const;

export const APP_CAPABILITIES = [
  "profile.read", "library.read", "library.write", "catalog.read",
  "project.read", "project.write", "build.create", "session.create",
  "session.read", "session.control", "stream.connect", "crossplay.identity",
  "crossplay.presence", "telemetry.write", "host.read", "host.manage",
] as const;
export type AppCapability = (typeof APP_CAPABILITIES)[number];

export const SUPPORTED_CLIENTS = ["web", "pwa", "desktop", "android", "ios", "tv", "headset"] as const;
export type SupportedClient = (typeof SUPPORTED_CLIENTS)[number];
export const SUPPORTED_GAME_MODES = ["local", "browser", "remote", "vm"] as const;
export type SupportedGameMode = (typeof SUPPORTED_GAME_MODES)[number];

export interface GameForgeAppManifest {
  appId: string;
  name: string;
  version: string;
  publisher: string;
  homepage?: string;
  callbackUrls: string[];
  requestedCapabilities: AppCapability[];
  supportedClients: SupportedClient[];
  supportedGameModes: SupportedGameMode[];
  sdkVersion: string;
  publicKey?: string;
}

export interface GameSummary { id: string; name: string; description?: string }
export interface CatalogPage { items: GameSummary[]; page: number; pageSize: number; total: number }
export interface RuntimeCapabilities {
  webgpu: boolean; webgl2: boolean; wasm: boolean; gamepad: boolean;
  touch: boolean; pointerLock: boolean; audio: boolean; localStorage: boolean;
  opfs: boolean; webRtc: boolean;
}
export interface CapabilityNegotiation {
  apiVersion: string;
  supported: AppCapability[];
  denied: AppCapability[];
  runtimeModes: SupportedGameMode[];
}

const APP_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{1,126}[a-zA-Z0-9])$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isUniqueArrayOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T[] =>
  Array.isArray(value) && value.every((item): item is T => typeof item === "string" && allowed.includes(item as T)) && new Set(value).size === value.length;

function isHttpsUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function isVersion(value: unknown): value is string {
  return isString(value) && SEMVER_PATTERN.test(value);
}

/** Validate the complete public manifest contract before a client accepts it. */
export function validateManifest(value: unknown): value is GameForgeAppManifest {
  if (!isRecord(value)) return false;
  const allowedKeys = new Set(["appId", "name", "version", "publisher", "homepage", "callbackUrls", "requestedCapabilities", "supportedClients", "supportedGameModes", "sdkVersion", "publicKey"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return false;
  if (!isString(value.appId) || !APP_ID_PATTERN.test(value.appId)) return false;
  if (!isString(value.name) || !isString(value.publisher)) return false;
  if (!isVersion(value.version) || !isVersion(value.sdkVersion)) return false;
  if (!Array.isArray(value.callbackUrls) || value.callbackUrls.length === 0 || !value.callbackUrls.every(isHttpsUrl)) return false;
  if (new Set(value.callbackUrls).size !== value.callbackUrls.length) return false;
  if (!isUniqueArrayOf(value.requestedCapabilities, APP_CAPABILITIES)) return false;
  if (!isUniqueArrayOf(value.supportedClients, SUPPORTED_CLIENTS) || value.supportedClients.length === 0) return false;
  if (!isUniqueArrayOf(value.supportedGameModes, SUPPORTED_GAME_MODES) || value.supportedGameModes.length === 0) return false;
  if (value.homepage !== undefined && !isHttpsUrl(value.homepage)) return false;
  if (value.publicKey !== undefined && !isString(value.publicKey)) return false;
  return true;
}
