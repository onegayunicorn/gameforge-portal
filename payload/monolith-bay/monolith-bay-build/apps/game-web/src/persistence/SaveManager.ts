const DB_NAME = "monolith-bay";
const DB_VERSION = 1;
const STORES = ["profiles", "saves", "settings", "characters", "manifests", "activity", "diagnostics"] as const;

export class SaveManager {
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async loadSettings<T>(): Promise<T> {
    return (await this.get("settings", "global")) as T;
  }

  async saveSettings(settings: unknown): Promise<void> {
    await this.put("settings", { id: "global", ...(settings as object) });
  }

  private async get(store: string, id: string): Promise<unknown> {
    if (!this.db) throw new Error("SaveManager not initialized");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, "readonly");
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result ?? {});
      req.onerror = () => reject(req.error);
    });
  }

  private async put(store: string, value: { id: string }): Promise<void> {
    if (!this.db) throw new Error("SaveManager not initialized");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, "readwrite");
      const req = tx.objectStore(store).put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
