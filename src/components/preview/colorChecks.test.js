import { describe, it, expect } from 'vitest';
import { colorChecks, contrastLevel, formatRatio } from './colorChecks.js';
import { contrastRatio } from './templates/kit/theme.js';
import { TEMPLATES } from '../../data/templates.js';

const byId = (checks) => Object.fromEntries(checks.map((c) => [c.id, c]));

describe('contrastLevel / formatRatio', () => {
  it('grades by WCAG thresholds', () => {
    expect(contrastLevel(21)).toBe('AAA');
    expect(contrastLevel(7)).toBe('AAA');
    expect(contrastLevel(4.5)).toBe('AA');
    expect(contrastLevel(4.49)).toBe('large');
    expect(contrastLevel(3)).toBe('large');
    expect(contrastLevel(2.99)).toBe('fail');
  });
  it('never rounds a failing ratio up to a passing one', () => {
    expect(formatRatio(4.49)).toBe('4.4:1');
    expect(formatRatio(4.5)).toBe('4.5:1');
    expect(formatRatio(21)).toBe('21.0:1');
  });
});

describe('colorChecks', () => {
  it('passes every visible template\'s own palette', () => {
    for (const t of Object.values(TEMPLATES).filter((x) => !x.hidden)) {
      const checks = byId(colorChecks(t.colors));
      expect({ id: t.id, text: checks.text.ratio >= 4.5 }).toEqual({ id: t.id, text: true });
      expect({ id: t.id, muted: checks.muted.ratio >= 4.5 }).toEqual({ id: t.id, muted: true });
    }
  });

  it('reports the repaired text color a theme-ready template paints', () => {
    const colors = { bg: '#ffffff', text: '#cccccc', muted: '#dddddd', accent: '#2563eb', secondary: '#f5f5f5' };
    const checks = byId(colorChecks(colors, { themeReady: true }));
    expect(checks.text.adjustedFrom).toBe('#cccccc');
    expect(checks.text.ratio).toBeGreaterThanOrEqual(4.5);
    expect(checks.text.level).toMatch(/AA/);
    // A legacy template paints the raw pick, so it fails.
    const legacy = byId(colorChecks(colors, { themeReady: false }));
    expect(legacy.text.adjustedFrom).toBe(null);
    expect(legacy.text.level).toBe('fail');
    expect(legacy.text.ratio).toBeCloseTo(contrastRatio('#cccccc', '#ffffff'), 5);
  });

  it('flags a brand color no button label can read on', () => {
    const checks = byId(colorChecks({ bg: '#000000', text: '#ffffff', accent: '#777777' }));
    expect(checks.button.ratio).toBeLessThan(4.5);
    expect(checks.button.adjustedFrom).toBe(null);
    const ok = byId(colorChecks({ bg: '#000000', text: '#ffffff', accent: '#1d4ed8' }));
    expect(ok.button.level).toMatch(/AA/);
    expect(ok.button.fg).toBe('#ffffff');
  });

  it('copes with missing or invalid colors', () => {
    expect(() => colorChecks({})).not.toThrow();
    expect(() => colorChecks(null)).not.toThrow();
    expect(colorChecks({ bg: 'nope', text: 'nope' }).length).toBe(3);
  });
});
