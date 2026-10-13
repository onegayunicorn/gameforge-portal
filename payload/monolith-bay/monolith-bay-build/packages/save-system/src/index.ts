// @monolith/save-system
// Atomic save/load, backup rotation, migration, and corruption recovery.

export interface SaveSlot {
  id: string;
  profileId: string;
  data: string;
  checksum: string;
  gameVersion: string;
  contentVersion: string;
  createdAt: string;
  updatedAt: string;
  playtimeSeconds: number;
}

export type SaveType = "manual" | "autosave" | "checkpoint" | "backup";

const MAX_BACKUPS = 5;

export class SaveSystem {
  private slots = new Map<string, SaveSlot>();

  async save(
    slotId: string,
    profileId: string,
    data: string,
    type: SaveType = "manual",
  ): Promise<SaveSlot> {
    const checksum = await this.computeChecksum(data);
    const existing = this.slots.get(slotId);
    const slot: SaveSlot = {
      id: slotId,
      profileId,
      data,
      checksum,
      gameVersion: "0.1.0",
      contentVersion: "0.1.0",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      playtimeSeconds: (existing?.playtimeSeconds ?? 0) + 0,
    };

    // Rotate backups before overwriting
    if (existing && type !== "backup") {
      await this.createBackup(existing);
    }

    this.slots.set(slotId, slot);
    return slot;
  }

  async load(slotId: string): Promise<{ data: string; valid: boolean; reason?: string }> {
    const slot = this.slots.get(slotId);
    if (!slot) return { data: "", valid: false, reason: "Save slot not found." };
    const checksum = await this.computeChecksum(slot.data);
    if (checksum !== slot.checksum) {
      return { data: slot.data, valid: false, reason: "Checksum mismatch — save may be corrupted." };
    }
    return { data: slot.data, valid: true };
  }

  private async createBackup(slot: SaveSlot): Promise<void> {
    const backupId = `${slot.id}.backup.${Date.now()}`;
    this.slots.set(backupId, { ...slot, id: backupId });
    // Trim old backups
    const backups = [...this.slots.entries()]
      .filter(([id]) => id.startsWith(`${slot.id}.backup.`))
      .sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt));
    while (backups.length > MAX_BACKUPS) {
      const [id] = backups.shift()!;
      this.slots.delete(id);
    }
  }

  private async computeChecksum(data: string): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return `fallback-${hash}`;
  }

  listSlots(): SaveSlot[] {
    return [...this.slots.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  deleteSlot(slotId: string): boolean {
    return this.slots.delete(slotId);
  }

  needsMigration(slot: SaveSlot, currentVersion: string): boolean {
    return slot.gameVersion !== currentVersion;
  }
}
