// @monolith/dialogue-engine
// Branching dialogue with conditions, effects, and accessibility controls.

export interface Requirement {
  type: "stat" | "item" | "relationship" | "time" | "quest" | "flag";
  target?: string;
  value?: number | string | boolean;
}

export interface StateEffect {
  type: "stat" | "relationship" | "quest" | "flag" | "item" | "money" | "message";
  target?: string;
  value?: number | string | boolean;
}

export interface DialogueChoice {
  id: string;
  text: string;
  conditions?: Requirement[];
  effects?: StateEffect[];
  nextNodeId?: string;
}

export interface DialogueNode {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  portrait?: string;
  choices?: DialogueChoice[];
  conditions?: Requirement[];
  effects?: StateEffect[];
  nextNodeId?: string;
  autoAdvance?: boolean;
}

export interface DialogueSettings {
  textSpeed: number; // characters per second, 0 = instant
  autoAdvanceDelay: number;
  showSpeakerName: boolean;
  subtitleSize: "small" | "medium" | "large";
}

export const DEFAULT_DIALOGUE_SETTINGS: DialogueSettings = {
  textSpeed: 40,
  autoAdvanceDelay: 3,
  showSpeakerName: true,
  subtitleSize: "medium",
};

export class DialogueEngine {
  private nodes = new Map<string, DialogueNode>();
  private currentNodeId: string | null = null;
  private history: Array<{ nodeId: string; choiceId?: string; timestamp: string }> = [];
  private settings: DialogueSettings = DEFAULT_DIALOGUE_SETTINGS;

  registerNode(node: DialogueNode) {
    this.nodes.set(node.id, node);
  }

  start(nodeId: string): DialogueNode | null {
    this.currentNodeId = nodeId;
    this.history.push({ nodeId, timestamp: new Date().toISOString() });
    return this.nodes.get(nodeId) ?? null;
  }

  getCurrentNode(): DialogueNode | null {
    return this.currentNodeId ? this.nodes.get(this.currentNodeId) ?? null : null;
  }

  selectChoice(choiceId: string): DialogueNode | null {
    const current = this.getCurrentNode();
    if (!current?.choices) return null;
    const choice = current.choices.find((c) => c.id === choiceId);
    if (!choice) return null;
    this.history.push({ nodeId: current.id, choiceId, timestamp: new Date().toISOString() });
    if (choice.nextNodeId) {
      this.currentNodeId = choice.nextNodeId;
      this.history.push({ nodeId: choice.nextNodeId, timestamp: new Date().toISOString() });
      return this.nodes.get(choice.nextNodeId) ?? null;
    }
    this.currentNodeId = null;
    return null;
  }

  advance(): DialogueNode | null {
    const current = this.getCurrentNode();
    if (!current?.nextNodeId) {
      this.currentNodeId = null;
      return null;
    }
    this.currentNodeId = current.nextNodeId;
    this.history.push({ nodeId: current.nextNodeId, timestamp: new Date().toISOString() });
    return this.nodes.get(current.nextNodeId) ?? null;
  }

  getHistory() {
    return [...this.history];
  }

  setSettings(settings: Partial<DialogueSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  getSettings(): DialogueSettings {
    return { ...this.settings };
  }
}
