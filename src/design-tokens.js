// src/design-tokens.js
// ProHub v1 — brand tokens for the Genius Websites app.
// Established 2026-04-24. Direction: bold red (#cc0000) on near-black
// ink (#1a1a1a) and warm neutral surface (#faf9f7). Outfit sans for
// everything. Sharp-to-barely-rounded corners. Subtle shadows, fast
// transitions. Mirror these values in tailwind.config.js.
export const tokens = {
  color: {
    brand: {
      red: '#cc0000',
      redHover: '#b30000',
      redFaint: '#fff5f5',
    },
    ink: {
      primary: '#1a1a1a',
      secondary: '#4a4a4a',
      tertiary: '#888888',
    },
    surface: {
      primary: '#ffffff',
      secondary: '#faf9f7',
      tertiary: '#f4f3f0',
    },
    border: {
      soft: 'rgba(0,0,0,0.07)',
      default: 'rgba(0,0,0,0.12)',
      strong: 'rgba(0,0,0,0.25)',
    },
    status: {
      success: '#0a8f3d',
      successFaint: '#e8f5ec',
      warning: '#b37400',
      warningFaint: '#fff7e6',
      danger: '#cc0000',
      dangerFaint: '#fff5f5',
    },
  },
  font: {
    sans: "'Outfit', system-ui, -apple-system, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  radius: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0,0,0,0.04)',
    md: '0 4px 12px -2px rgba(0,0,0,0.08)',
    lg: '0 12px 32px -4px rgba(0,0,0,0.12)',
  },
  transition: {
    fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '320ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  layout: {
    maxContent: '1280px',
    headerHeight: '64px',
  },
};

// Connect Embedded Components appearance config derived from the tokens.
// Passed to loadConnectAndInitialize({ appearance: connectAppearance }).
export const connectAppearance = {
  overlays: 'dialog',
  variables: {
    colorPrimary: tokens.color.brand.red,
    colorBackground: tokens.color.surface.primary,
    colorText: tokens.color.ink.primary,
    colorDanger: tokens.color.status.danger,
    fontFamily: tokens.font.sans,
    borderRadius: tokens.radius.sm,
    spacingUnit: '6px',
  },
};
