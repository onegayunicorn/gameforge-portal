// @monolith/relationship-engine
// Relationship state, stages, gating, and interaction rules.

export interface RelationshipMilestone {
  id: string;
  affectionThreshold: number;
  label: string;
  unlocks: string[];
}

export interface CharacterRelationshipProfile {
  characterId: string;
  startingAffection: number;
  startingTrust: number;
  likes: string[];
  dislikes: string[];
  milestones: RelationshipMilestone[];
  maxAffection: number;
}

export interface RelationshipState {
  characterId: string;
  affection: number;
  trust: number;
  currentStage: string;
  interactions: Array<{ type: string; timestamp: string; delta: number }>;
}

export type InteractionType =
  | "talk"
  | "give-gift"
  | "invite-date"
  | "follow"
  | "ask-intimacy"
  | "end-interaction"
  | "return-later";

export class RelationshipEngine {
  private profiles = new Map<string, CharacterRelationshipProfile>();
  private states = new Map<string, RelationshipState>();

  registerProfile(profile: CharacterRelationshipProfile) {
    this.profiles.set(profile.characterId, profile);
    if (!this.states.has(profile.characterId)) {
      this.states.set(profile.characterId, {
        characterId: profile.characterId,
        affection: profile.startingAffection,
        trust: profile.startingTrust,
        currentStage: profile.milestones[0]?.id ?? "stranger",
        interactions: [],
      });
    }
  }

  getState(characterId: string): RelationshipState | undefined {
    return this.states.get(characterId);
  }

  getAvailableInteractions(characterId: string): InteractionType[] {
    const state = this.states.get(characterId);
    const profile = this.profiles.get(characterId);
    if (!state || !profile) return [];

    const interactions: InteractionType[] = ["talk", "give-gift", "end-interaction", "return-later"];
    if (state.affection >= 20) interactions.push("invite-date");
    if (state.affection >= 50 && state.trust >= 30) interactions.push("follow");
    // Intimacy requires explicit relationship stage and consent-aware design.
    const intimacyUnlocked = profile.milestones.some(
      (m) => m.id === state.currentStage && m.unlocks.includes("intimacy"),
    );
    if (intimacyUnlocked) interactions.push("ask-intimacy");
    return interactions;
  }

  applyInteraction(characterId: string, type: InteractionType, itemId?: string): { delta: number; message: string } {
    const state = this.states.get(characterId);
    const profile = this.profiles.get(characterId);
    if (!state || !profile) return { delta: 0, message: "Character not found." };

    let delta = 0;
    let message = "";

    switch (type) {
      case "talk":
        delta = 2;
        message = "You had a pleasant conversation.";
        break;
      case "give-gift":
        if (itemId && profile.likes.includes(itemId)) {
          delta = 10;
          message = "They loved the gift!";
        } else if (itemId && profile.dislikes.includes(itemId)) {
          delta = -5;
          message = "They didn't seem to like it.";
        } else {
          delta = 3;
          message = "They appreciated the thought.";
        }
        break;
      case "invite-date":
        delta = 5;
        message = "They agreed to go on a date.";
        break;
      default:
        delta = 0;
    }

    state.affection = Math.max(0, Math.min(profile.maxAffection, state.affection + delta));
    state.interactions.push({ type, timestamp: new Date().toISOString(), delta });
    this.updateStage(characterId);
    return { delta, message };
  }

  private updateStage(characterId: string) {
    const state = this.states.get(characterId);
    const profile = this.profiles.get(characterId);
    if (!state || !profile) return;
    for (const milestone of [...profile.milestones].reverse()) {
      if (state.affection >= milestone.affectionThreshold) {
        state.currentStage = milestone.id;
        break;
      }
    }
  }
}
