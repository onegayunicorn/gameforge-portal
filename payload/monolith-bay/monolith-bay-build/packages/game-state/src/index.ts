// @monolith/game-state
// Canonical game state model and serialization.

export type TimePeriod = "morning" | "afternoon" | "evening" | "night";

export interface TimeState {
  day: number;
  period: TimePeriod;
  minutes: number;
  calendarFlags: string[];
}

export interface CharacterAppearance {
  bodyPreset: string;
  facePreset: string;
  hairPreset: string;
  skinTone: string;
  eyeColor: string;
  clothing: string[];
  accessories: string[];
}

export interface PlayerProfile {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  money: number;
  stats: Record<string, number>;
  currentLocationId: string;
  currentPosition: [number, number, number];
  activeCharacterId?: string;
}

export interface QuestState {
  questId: string;
  status: "available" | "accepted" | "active" | "blocked" | "completed" | "failed" | "expired" | "migrated";
  objectives: Record<string, boolean>;
  startedAt: string;
  completedAt?: string;
  playerNotes?: string;
}

export interface RelationshipState {
  characterId: string;
  affection: number;
  trust: number;
  stage: string;
  giftHistory: Array<{ itemId: string; date: string; reaction: "positive" | "neutral" | "negative" }>;
  dateHistory: Array<{ activityId: string; date: string; outcome: string }>;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  acquiredAt: string;
  favorite?: boolean;
}

export interface InventoryState {
  items: InventoryItem[];
  capacity: number;
}

export interface MessageState {
  id: string;
  fromCharacterId: string;
  text: string;
  timestamp: string;
  timePeriod: TimePeriod;
  read: boolean;
  questLink?: string;
  relationshipImpact?: number;
}

export interface ActivityState {
  activityId: string;
  bestScore?: number;
  completedCount: number;
  lastPlayed?: string;
  cooldownUntil?: string;
}

export interface SaveMetadata {
  gameVersion: string;
  contentVersion: string;
  contentHash: string;
  createdAt: string;
  saveId: string;
  profileId: string;
  cheatsEnabled: boolean;
}

export interface GameSettings {
  graphics: Record<string, unknown>;
  audio: Record<string, unknown>;
  input: Record<string, unknown>;
  ui: Record<string, unknown>;
  accessibility: Record<string, unknown>;
}

export interface GameState {
  profile: PlayerProfile;
  world: { worldId: string; locationId: string; flags: Record<string, boolean> };
  quests: QuestState[];
  relationships: RelationshipState[];
  inventory: InventoryState;
  messages: MessageState[];
  activities: ActivityState[];
  flags: Record<string, boolean>;
  variables: Record<string, number | string>;
  time: TimeState;
  settings: GameSettings;
  saveMeta: SaveMetadata;
}

export function createInitialState(profile: PlayerProfile): GameState {
  return {
    profile,
    world: { worldId: "world.town", locationId: "location.town-square", flags: {} },
    quests: [],
    relationships: [],
    inventory: { items: [], capacity: 50 },
    messages: [],
    activities: [],
    flags: {},
    variables: {},
    time: { day: 1, period: "morning", minutes: 480, calendarFlags: [] },
    settings: {
      graphics: {},
      audio: {},
      input: {},
      ui: {},
      accessibility: {},
    },
    saveMeta: {
      gameVersion: "0.1.0",
      contentVersion: "0.1.0",
      contentHash: "",
      createdAt: new Date().toISOString(),
      saveId: crypto.randomUUID(),
      profileId: profile.id,
      cheatsEnabled: false,
    },
  };
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState {
  return JSON.parse(json) as GameState;
}
