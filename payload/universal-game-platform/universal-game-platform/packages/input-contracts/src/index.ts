/**
 * @ugp/input-contracts
 * Keyboard, mouse, touch, controller, XR input; action mapping; input state snapshots
 */
export interface InputServices {
  // Contract interface — implemented by platform runtime
  version: string;
  initialize(config: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export const CONTRACT_VERSION = "1.0.0";
