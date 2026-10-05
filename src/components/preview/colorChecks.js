import { deriveTheme, contrastRatio, hexToRgb, rgbToHex, readableOn } from './templates/kit/theme.js';

// Readability checks for the Colors panel (ContentEditor.jsx): the pairs a
// visitor reads, with the colors the site actually paints. Theme-ready
// templates paint with deriveTheme(), which nudges text and muted text
// until they reach 4.5:1 on the page (and cards where it can), so a low
// pick shows as "adjusted" there; legacy templates paint the raw picks.
// Button text is white or near-black, whichever reads better on the brand
// color; nothing repairs that pair, so a failing brand color is flagged.

const norm = (c) => {
  const v = hexToRgb(c);
  return v ? rgbToHex(v.r, v.g, v.b) : null;
};

// WCAG 2.x levels for normal-size text.
export function contrastLevel(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'large';
  return 'fail';
}

export function colorChecks(colors, { themeReady = true } = {}) {
  const c = colors || {};
  const theme = deriveTheme(c);
  const bg = theme.bg;
  const pair = (id, label, pick, painted, background) => {
    const ratio = contrastRatio(painted, background);
    const picked = norm(pick);
    return {
      id,
      label,
      fg: painted,
      bg: background,
      ratio,
      level: contrastLevel(ratio),
      // The owner's pick, when the site paints something else instead.
      adjustedFrom: picked && picked !== norm(painted) ? picked : null,
    };
  };
  const text = themeReady ? theme.text : norm(c.text) || theme.text;
  const muted = themeReady ? theme.textMuted : norm(c.muted) || theme.textMuted;
  const accent = theme.accent;
  const onAccent = themeReady ? theme.onAccent : readableOn(accent);
  return [
    pair('text', 'Text on background', c.text, text, bg),
    pair('muted', 'Muted text on background', c.muted, muted, bg),
    { ...pair('button', 'Button text on brand color', null, onAccent, accent), adjustedFrom: null },
  ];
}

export function formatRatio(ratio) {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
}
