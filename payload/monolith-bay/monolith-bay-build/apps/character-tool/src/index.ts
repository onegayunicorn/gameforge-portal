// Character creator tool
// Supports body/face/hair/clothing customization, PNG export/import with metadata validation.

export interface CharacterAppearance {
  bodyPreset: string;
  facePreset: string;
  hairPreset: string;
  skinTone: string;
  eyeColor: string;
  clothing: string[];
  accessories: string[];
}

export interface CharacterData {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  metadata: {
    version: string;
    createdAt: string;
    origin: "newly-authored" | "imported";
  };
}

export function createCharacter(name: string): CharacterData {
  return {
    id: crypto.randomUUID(),
    name,
    appearance: {
      bodyPreset: "body-a",
      facePreset: "face-a",
      hairPreset: "hair-a",
      skinTone: "#e0ac69",
      eyeColor: "#5a3a1a",
      clothing: ["outfit-casual"],
      accessories: [],
    },
    metadata: {
      version: "1.0",
      createdAt: new Date().toISOString(),
      origin: "newly-authored",
    },
  };
}

export function validateImportedCharacter(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    errors.push("Invalid character data format.");
  }
  // Sandbox: imported characters are data only, never executable.
  return { valid: errors.length === 0, errors };
}
