/**
 * @ugp/runtime-contracts
 * Platform lifecycle, fixed-step updates, frame scheduling, pause/resume, service init, safe shutdown
 */
export interface RuntimeServices {
  // Contract interface — implemented by platform runtime
  version: string;
  initialize(config: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export const CONTRACT_VERSION = "1.0.0";
