import { describe, it, expect } from 'vitest';
import {
  hexToRgb, rgbToHex, mix, alpha, luminance, contrastRatio, isDark,
  readableOn, ensureContrast, deriveTheme,
} from './theme.js';
import { TEMPLATES } from '../../../../data/templates.js';

describe('hexToRgb / rgbToHex', () => {
  it('parses 3, 6 and 8 digit hex with or without #', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('0A0b0C')).toEqual({ r: 10, g: 11, b: 12 });
    expect(hexToRgb('#11223380')).toEqual({ r: 17, g: 34, b: 51 });
  });

  it('parses rgb()/rgba()', () => {
    expect(hexToRgb('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(hexToRgb('rgba(255,0,10,0.5)')).toEqual({ r: 255, g: 0, b: 10 });
  });

  it('returns null for anything else', () => {
    for (const bad of ['red', '#12', '#ggg', '', null, undefined, 42, {}]) expect(hexToRgb(bad)).toBeNull();
  });

  it('formats lowercase #rrggbb, clamping and rounding', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 16 })).toBe('#ff0010');
    expect(rgbToHex(300, -5, 127.6)).toBe('#ff0080');
    expect(rgbToHex(hexToRgb('#ABCDEF'))).toBe('#abcdef');
  });
});

describe('mix / alpha', () => {
  it('blends linearly and clamps t', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 2)).toBe('#ffffff');
  });

  it('falls back to the valid input', () => {
    expect(mix('nope', '#ABCDEF', 0.5)).toBe('#abcdef');
    expect(mix(undefined, undefined, 0.5)).toBe('#000000');
  });

  it('formats rgba()', () => {
    expect(alpha('#ff0000', 0.2)).toBe('rgba(255, 0, 0, 0.2)');
    expect(alpha('garbage', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    expect(alpha('#ffffff', 5)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('luminance / contrast', () => {
  it('matches WCAG reference values', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBe(0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'), 10);
  });

  it('classifies dark and light colors', () => {
    expect(isDark('#111111')).toBe(true);
    expect(isDark('#1f1f1f')).toBe(true);
    expect(isDark('#fffbeb')).toBe(false);
    expect(isDark('#ffffff')).toBe(false);
  });

  it('readableOn picks the higher-contrast option', () => {
    expect(readableOn('#111111')).toBe('#ffffff');
    expect(readableOn('#fffbeb')).toBe('#111111');
    expect(readableOn('#f59e0b')).toBe('#111111');
    expect(readableOn('#0f172a', { light: '#fafafa', dark: '#0a0a0a' })).toBe('#fafafa');
  });
});

describe('ensureContrast', () => {
  it('returns fg untouched when it already passes', () => {
    expect(ensureContrast('#AAAAAA', '#111111')).toBe('#AAAAAA');
    expect(ensureContrast('#777777', '#ffffff', 3)).toBe('#777777');
  });

  it('lightens on dark backgrounds and darkens on light ones', () => {
    const onDark = ensureContrast('#555555', '#111111');
    expect(contrastRatio(onDark, '#111111')).toBeGreaterThanOrEqual(4.5);
    expect(luminance(onDark)).toBeGreaterThan(luminance('#555555'));

    const onLight = ensureContrast('#f59e0b', '#fffbeb');
    expect(contrastRatio(onLight, '#fffbeb')).toBeGreaterThanOrEqual(4.5);
    expect(luminance(onLight)).toBeLessThan(luminance('#f59e0b'));
  });

  it('changes as little as needed', () => {
    const out = ensureContrast('#999999', '#ffffff');
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out, '#ffffff')).toBeLessThan(5);
  });

  it('works on mid-tone backgrounds from either side', () => {
    for (const bg of ['#808080', '#e53e3e', '#06b6d4']) {
      for (const fg of ['#7a7a7a', '#ff4444', '#10c0e0']) {
        expect(contrastRatio(ensureContrast(fg, bg), bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('returns the best extreme when the target is unreachable, and never throws', () => {
    expect(ensureContrast('#777777', '#777777', 21)).toMatch(/^#(000000|ffffff)$/);
    expect(ensureContrast('nope', '#111111')).toBe('#ffffff');
    expect(ensureContrast('#ABCDEF', 'nope')).toBe('#abcdef');
    expect(() => ensureContrast(undefined, undefined)).not.toThrow();
  });
});

describe('deriveTheme', () => {
  const COLOR = /^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/;
  const COLOR_KEYS = ['bg', 'surface', 'surfaceAlt', 'text', 'textMuted', 'accent', 'onAccent', 'accentText', 'accentSoft', 'border', 'borderStrong', 'focus', 'onHero'];

  it.each(Object.values(TEMPLATES).map((t) => [t.id, t.colors]))('keeps every text pair readable: %s', (_id, colors) => {
    const t = deriveTheme(colors);
    expect(t.bg).toBe(colors.bg.toLowerCase());
    expect(t.accent).toBe(colors.accent.toLowerCase());
    expect(t.surface).toBe(colors.secondary.toLowerCase());
    expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.textMuted, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accentText, t.bg)).toBeGreaterThanOrEqual(4.5);
    // Cards and alternating sections sit on the surface color.
    for (const k of ['text', 'textMuted', 'accentText']) {
      expect(contrastRatio(t[k], t.surface), `${k} on surface`).toBeGreaterThanOrEqual(4.5);
    }
    expect(t.onAccent).toBe(readableOn(t.accent));
    expect(t.isDark).toBe(isDark(colors.bg));
    for (const k of COLOR_KEYS) expect(t[k], k).toMatch(COLOR);
    expect(t.heroScrim).toMatch(/^linear-gradient\(/);
    expect(t.heroScrimLeft).toMatch(/^linear-gradient\(/);
  });

  it('keeps an owner muted color that already passes', () => {
    expect(deriveTheme({ bg: '#111111', text: '#ffffff', muted: '#AAAAAA' }).textMuted).toBe('#aaaaaa');
  });

  it('repairs an unreadable owner palette', () => {
    const t = deriveTheme({ bg: '#ffffff', text: '#eeeeee', muted: '#f0f0f0', accent: '#ffe066' });
    expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.textMuted, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accentText, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(t.accent).toBe('#ffe066');
    expect(t.onAccent).toBe('#111111');
  });

  it('never trades bg contrast for surface contrast', () => {
    // An owner card color on the opposite side of mid-gray from the page:
    // text stays readable on the page, which it covers most of.
    const t = deriveTheme({ bg: '#111111', text: '#ffffff', secondary: '#f5f5f5', muted: '#999999', accent: '#e53e3e' });
    expect(t.surface).toBe('#f5f5f5');
    for (const k of ['text', 'textMuted', 'accentText']) {
      expect(contrastRatio(t[k], t.bg), k).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('derives a surface when there is no secondary color', () => {
    const t = deriveTheme({ bg: '#ffffff', text: '#111111', accent: '#2563eb' });
    expect(t.surface).not.toBe('#ffffff');
    expect(contrastRatio(t.surface, '#ffffff')).toBeLessThan(1.3);
  });

  it('never throws and falls back sensibly on missing or invalid input', () => {
    for (const input of [undefined, null, {}, 'red', 42, { bg: 'nope', accent: 12, text: null }]) {
      const t = deriveTheme(input);
      for (const k of COLOR_KEYS) expect(t[k], k).toMatch(COLOR);
      expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(deriveTheme({}).bg).toBe('#ffffff');
    expect(deriveTheme({ text: '#ffffff' }).isDark).toBe(true);
  });
});
