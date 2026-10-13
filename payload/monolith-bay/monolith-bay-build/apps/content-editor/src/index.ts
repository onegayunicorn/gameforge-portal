// Content editor entry point
// Visual editors for quests, dialogue, items, characters, relationships, and world data.

export type EditorTab = "quests" | "dialogue" | "items" | "characters" | "worlds" | "activities";

export interface ContentEditorState {
  activeTab: EditorTab;
  dirty: boolean;
  lastSaved: string | null;
}

export function createContentEditor(): ContentEditorState {
  return {
    activeTab: "quests",
    dirty: false,
    lastSaved: null,
  };
}

export async function validateContent(_content: unknown): Promise<string[]> {
  // Placeholder: run content validators and return list of errors
  return [];
}
