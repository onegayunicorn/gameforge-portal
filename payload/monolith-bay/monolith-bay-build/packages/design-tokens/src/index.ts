// @monolith/design-tokens
// Central design system: colors, typography, spacing, radii, shadows, motion.

export const colorTokens = {
  bg: "#10131c",
  panel: "#1a2030",
  panelRaised: "#242d42",
  primary: "#8ed8ff",
  secondary: "#ff9bc8",
  accent: "#f9d77e",
  success: "#8fe3a6",
  warning: "#ffd27a",
  danger: "#ff8e9e",
  text: "#f4f7fb",
  muted: "#a9b4c6",
} as const;

export const radiusTokens = {
  sm: "6px",
  md: "12px",
  lg: "20px",
} as const;

export const shadowTokens = {
  panel: "0 14px 40px rgba(0, 0, 0, 0.35)",
  modal: "0 24px 60px rgba(0, 0, 0, 0.5)",
  toast: "0 8px 24px rgba(0, 0, 0, 0.4)",
} as const;

export const fontTokens = {
  ui: "Inter, system-ui, sans-serif",
  display: '"Trebuchet MS", system-ui, sans-serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const spacingTokens = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

export const motionTokens = {
  fast: "150ms",
  normal: "250ms",
  slow: "400ms",
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const uiScaleOptions = [0.75, 0.9, 1.0, 1.1, 1.25, 1.5] as const;

export function generateCssVariables(): string {
  return `
:root {
  --color-bg: ${colorTokens.bg};
  --color-panel: ${colorTokens.panel};
  --color-panel-raised: ${colorTokens.panelRaised};
  --color-primary: ${colorTokens.primary};
  --color-secondary: ${colorTokens.secondary};
  --color-accent: ${colorTokens.accent};
  --color-success: ${colorTokens.success};
  --color-warning: ${colorTokens.warning};
  --color-danger: ${colorTokens.danger};
  --color-text: ${colorTokens.text};
  --color-muted: ${colorTokens.muted};
  --radius-sm: ${radiusTokens.sm};
  --radius-md: ${radiusTokens.md};
  --radius-lg: ${radiusTokens.lg};
  --shadow-panel: ${shadowTokens.panel};
  --font-ui: ${fontTokens.ui};
  --font-display: ${fontTokens.display};
}
`.trim();
}
