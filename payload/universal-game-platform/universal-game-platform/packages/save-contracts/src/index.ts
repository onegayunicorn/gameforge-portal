/**
 * @ugp/save-contracts
 * Save slots, cloud sync, offline storage, versioned save data, migration
 */
export interface SaveServices {
  // Contract interface — implemented by platform runtime
  version: string;
  initialize(config: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export const CONTRACT_VERSION = "1.0.0";
