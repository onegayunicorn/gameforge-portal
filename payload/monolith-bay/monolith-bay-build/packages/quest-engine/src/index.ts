// @monolith/quest-engine
// Quest definitions, objectives, state tracking, and gating.

export type QuestStatus =
  | "available"
  | "accepted"
  | "active"
  | "blocked"
  | "completed"
  | "failed"
  | "expired"
  | "migrated";

export type ObjectiveType =
  | "interact"
  | "collect"
  | "use-item"
  | "talk-to"
  | "reach-location"
  | "complete-activity"
  | "give-gift"
  | "reach-stat"
  | "reach-relationship";

export interface Requirement {
  type: "stat" | "item" | "relationship" | "time" | "quest" | "flag" | "money";
  target?: string;
  value?: number | string | boolean;
}

export interface ObjectiveDefinition {
  id: string;
  text: string;
  type: ObjectiveType;
  targetId?: string;
  itemId?: string;
  count?: number;
  locationId?: string;
}

export interface RewardDefinition {
  type: "item" | "money" | "stat" | "relationship" | "unlock";
  id?: string;
  amount?: number;
}

export interface TimeWindow {
  periods?: string[];
  days?: number[];
  deadline?: string;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  giverId?: string;
  objectives: ObjectiveDefinition[];
  rewards: RewardDefinition[];
  requirements: Requirement[];
  timeWindow?: TimeWindow;
  mapMarkers?: string[];
  category: "main" | "side" | "activity" | "relationship";
}

export class QuestEngine {
  private definitions = new Map<string, QuestDefinition>();
  private state = new Map<string, QuestStatus>();

  register(def: QuestDefinition) {
    this.definitions.set(def.id, def);
  }

  getDefinition(id: string): QuestDefinition | undefined {
    return this.definitions.get(id);
  }

  getStatus(id: string): QuestStatus {
    return this.state.get(id) ?? "available";
  }

  setStatus(id: string, status: QuestStatus) {
    this.state.set(id, status);
  }

  canAccept(id: string, context: { stats: Record<string, number>; items: string[]; flags: Record<string, boolean> }): boolean {
    const def = this.definitions.get(id);
    if (!def) return false;
    return def.requirements.every((req) => this.checkRequirement(req, context));
  }

  private checkRequirement(req: Requirement, ctx: { stats: Record<string, number>; items: string[]; flags: Record<string, boolean> }): boolean {
    switch (req.type) {
      case "stat":
        return (ctx.stats[req.target ?? ""] ?? 0) >= (req.value as number);
      case "item":
        return ctx.items.includes(req.target ?? "");
      case "flag":
        return ctx.flags[req.target ?? ""] === req.value;
      default:
        return true;
    }
  }

  listByCategory(category: QuestDefinition["category"]): QuestDefinition[] {
    return [...this.definitions.values()].filter((q) => q.category === category);
  }
}
