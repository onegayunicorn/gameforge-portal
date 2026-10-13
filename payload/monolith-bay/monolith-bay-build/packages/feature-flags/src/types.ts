// Type definitions for @monolith/feature-flags
// TODO: Implement full type system per blueprint specification.

export interface feature_flags_Config {
  enabled: boolean;
  [key: string]: unknown;
}
