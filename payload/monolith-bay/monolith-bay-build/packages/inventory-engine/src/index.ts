// @monolith/inventory-engine
// Inventory categories, items, actions, and validation.

export type ItemCategory =
  | "quest"
  | "gift"
  | "consumable"
  | "character-asset"
  | "puzzle"
  | "collectible"
  | "special-world";

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  icon: string;
  stackable: boolean;
  maxStack: number;
  sellable: boolean;
  value?: number;
  giftPreference?: { characterId: string; reaction: "positive" | "neutral" | "negative" }[];
  questAssociation?: string;
  consumable?: { effect: Record<string, number> };
  puzzleState?: Record<string, unknown>;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
  favorite: boolean;
  acquiredAt: string;
}

export class InventoryEngine {
  private definitions = new Map<string, ItemDefinition>();
  private slots: InventorySlot[] = [];
  private capacity = 50;

  registerItem(def: ItemDefinition) {
    this.definitions.set(def.id, def);
  }

  getItem(id: string): ItemDefinition | undefined {
    return this.definitions.get(id);
  }

  addItem(itemId: string, quantity = 1): boolean {
    const def = this.definitions.get(itemId);
    if (!def) return false;

    const existing = this.slots.find((s) => s.itemId === itemId);
    if (existing && def.stackable && existing.quantity < def.maxStack) {
      existing.quantity = Math.min(existing.quantity + quantity, def.maxStack);
      return true;
    }

    if (this.slots.length >= this.capacity) return false;
    this.slots.push({ itemId, quantity, favorite: false, acquiredAt: new Date().toISOString() });
    return true;
  }

  removeItem(itemId: string, quantity = 1): boolean {
    const slot = this.slots.find((s) => s.itemId === itemId);
    if (!slot || slot.quantity < quantity) return false;
    slot.quantity -= quantity;
    if (slot.quantity <= 0) {
      this.slots = this.slots.filter((s) => s !== slot);
    }
    return true;
  }

  hasItem(itemId: string, quantity = 1): boolean {
    const slot = this.slots.find((s) => s.itemId === itemId);
    return !!slot && slot.quantity >= quantity;
  }

  getSlotsByCategory(category: ItemCategory): InventorySlot[] {
    return this.slots.filter((s) => this.definitions.get(s.itemId)?.category === category);
  }

  toggleFavorite(itemId: string) {
    const slot = this.slots.find((s) => s.itemId === itemId);
    if (slot) slot.favorite = !slot.favorite;
  }

  getSlots(): InventorySlot[] {
    return [...this.slots];
  }
}
