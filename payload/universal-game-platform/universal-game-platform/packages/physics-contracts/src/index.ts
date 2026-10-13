/**
 * @ugp/physics-contracts
 * Rigid body, collision, raycast, fixed-step simulation, physics backend abstraction
 */
export interface PhysicsServices {
  // Contract interface — implemented by platform runtime
  version: string;
  initialize(config: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export const CONTRACT_VERSION = "1.0.0";
