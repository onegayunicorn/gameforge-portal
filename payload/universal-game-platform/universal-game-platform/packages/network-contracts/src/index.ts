/**
 * @ugp/network-contracts
 * Client/server, netcode, replication, matchmaking, relay, offline fallback
 */
export interface NetworkServices {
  // Contract interface — implemented by platform runtime
  version: string;
  initialize(config: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export const CONTRACT_VERSION = "1.0.0";
