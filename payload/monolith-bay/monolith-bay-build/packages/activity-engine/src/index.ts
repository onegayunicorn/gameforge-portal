// @monolith/activity-engine
// Repeatable activities: pizza delivery, bike racing, etc.

export type ActivityType = "pizza-delivery" | "bike-race" | "minigame";

export interface ActivityDefinition {
  id: string;
  type: ActivityType;
  name: string;
  description: string;
  locationId: string;
  cooldownMinutes: number;
  rewards: Array<{ type: "money" | "stat" | "item"; id?: string; amount: number }>;
  requirements?: Array<{ type: string; target?: string; value?: number }>;
}

export interface ActivitySession {
  activityId: string;
  startedAt: string;
  state: "countdown" | "active" | "completed" | "failed";
  score: number;
  timeLimitSeconds?: number;
  elapsedSeconds: number;
  checkpoints?: Array<{ id: string; reached: boolean }>;
}

export interface ActivityResult {
  activityId: string;
  success: boolean;
  score: number;
  timeSeconds: number;
  rewards: Array<{ type: string; id?: string; amount: number }>;
  newBest?: boolean;
}

export class ActivityEngine {
  private definitions = new Map<string, ActivityDefinition>();
  private bestScores = new Map<string, number>();
  private lastPlayed = new Map<string, string>();
  private activeSession: ActivitySession | null = null;

  register(def: ActivityDefinition) {
    this.definitions.set(def.id, def);
  }

  canStart(activityId: string): { allowed: boolean; reason?: string } {
    const def = this.definitions.get(activityId);
    if (!def) return { allowed: false, reason: "Activity not found." };
    const last = this.lastPlayed.get(activityId);
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < def.cooldownMinutes * 60 * 1000) {
        const remaining = Math.ceil((def.cooldownMinutes * 60 * 1000 - elapsed) / 60000);
        return { allowed: false, reason: `Cooldown: ${remaining} minutes remaining.` };
      }
    }
    return { allowed: true };
  }

  start(activityId: string): ActivitySession | null {
    const def = this.definitions.get(activityId);
    if (!def) return null;
    const session: ActivitySession = {
      activityId,
      startedAt: new Date().toISOString(),
      state: "countdown",
      score: 0,
      elapsedSeconds: 0,
    };
    this.activeSession = session;
    return session;
  }

  complete(success: boolean, score: number, timeSeconds: number): ActivityResult | null {
    const session = this.activeSession;
    if (!session) return null;
    const def = this.definitions.get(session.activityId);
    if (!def) return null;

    session.state = success ? "completed" : "failed";
    session.score = score;
    this.lastPlayed.set(session.activityId, new Date().toISOString());

    const previousBest = this.bestScores.get(session.activityId) ?? 0;
    const newBest = score > previousBest;
    if (newBest) this.bestScores.set(session.activityId, score);

    const rewards = success ? def.rewards : [];
    this.activeSession = null;

    return {
      activityId: session.activityId,
      success,
      score,
      timeSeconds,
      rewards,
      newBest,
    };
  }

  getBestScore(activityId: string): number {
    return this.bestScores.get(activityId) ?? 0;
  }

  getActiveSession(): ActivitySession | null {
    return this.activeSession;
  }
}
