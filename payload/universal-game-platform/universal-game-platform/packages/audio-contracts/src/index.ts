/**
 * @ugp/audio-contracts
 * Spatial audio, music, SFX, mixing, format negotiation (ogg/mp3/wav)
 */
export interface AudioServices {
  // Contract interface — implemented by platform runtime
  version: string;
  initialize(config: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export const CONTRACT_VERSION = "1.0.0";
