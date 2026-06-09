import { describe, it, expect } from 'vitest';
import { defaultAppearance, normalizeAppearance, defaultSchedulerConfig } from './schedulerConfig.js';

describe('appearance', () => {
  it('default appearance has all themeable fields', () => {
    const a = defaultAppearance();
    expect(a).toEqual({
      page_style: 'branded',
      accent_color: '#1a1a1a',
      background: 'light',
      background_image_url: '',
      corner_style: 'rounded',
      font: 'Inter',
      logo_url: '',
      tagline: '',
    });
  });

  it('defaultSchedulerConfig includes appearance', () => {
    expect(defaultSchedulerConfig().appearance).toEqual(defaultAppearance());
  });

  it('normalizeAppearance fills missing fields and rejects bad enums', () => {
    const a = normalizeAppearance({ page_style: 'minimal', accent_color: '#ff0000', background: 'bogus' });
    expect(a.page_style).toBe('minimal');
    expect(a.accent_color).toBe('#ff0000');
    expect(a.background).toBe('light'); // bad enum falls back
    expect(a.corner_style).toBe('rounded'); // missing → default
  });

  it('normalizeAppearance coerces a non-object to defaults', () => {
    expect(normalizeAppearance(undefined)).toEqual(defaultAppearance());
  });
});
