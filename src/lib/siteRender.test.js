import { describe, it, expect } from 'vitest';
import { unpackGeneratedContent, buildTemplateMeta, resolveSiteRender, withWidgetKeys } from './siteRender.js';
import { TEMPLATES } from '../data/templates.js';

const stored = {
  headline: 'Best detailing in Mesa',
  _images: { logo: 'https://cdn.example/logo.png', hero: 'https://cdn.example/hero.jpg' },
  _customColors: { accent: '#123456' },
  _customFonts: { font: "'Oswald', sans-serif" },
};

describe('unpackGeneratedContent', () => {
  it('splits copy from images, colors and fonts without mutating the row', () => {
    const before = structuredClone(stored);
    const out = unpackGeneratedContent(stored);
    expect(out.copy).toEqual({ headline: 'Best detailing in Mesa' });
    expect(out.images).toEqual(stored._images);
    expect(out.customColors).toEqual({ accent: '#123456' });
    expect(out.customFonts).toEqual({ font: "'Oswald', sans-serif" });
    expect(stored).toEqual(before);
  });

  it('handles an empty row', () => {
    expect(unpackGeneratedContent(null)).toEqual({ copy: {}, images: {}, customColors: {}, customFonts: {} });
  });
});

describe('buildTemplateMeta', () => {
  it('layers owner colors and fonts over the template defaults', () => {
    const base = TEMPLATES.detailing_sporty;
    const meta = buildTemplateMeta('detailing_sporty', { accent: '#123456' }, { bodyFont: "'Lato', sans-serif" });
    expect(meta.colors).toEqual({ ...base.colors, accent: '#123456' });
    expect(meta.font).toBe(base.font);
    expect(meta.bodyFont).toBe("'Lato', sans-serif");
    expect(base.colors.accent).not.toBe('#123456');
  });

  it('returns null for an unknown template', () => {
    expect(buildTemplateMeta('nope')).toBeNull();
  });
});

describe('resolveSiteRender', () => {
  it('publishes with the owner images, colors and fonts, not stock template values', () => {
    const site = { id: 's1', business_info: { businessName: 'Acme' }, template_id: 'detailing_sporty', widget_config_ids: ['w1'] };
    const r = resolveSiteRender(site, stored);
    expect(r.siteId).toBe('s1');
    expect(r.templateId).toBe('detailing_sporty');
    expect(r.images).toEqual(stored._images);
    expect(r.templateMeta.colors.accent).toBe('#123456');
    expect(r.templateMeta.font).toBe("'Oswald', sans-serif");
    expect(r.generatedCopy).toEqual({ headline: 'Best detailing in Mesa' });
    expect(r.selectedWidgetIds).toEqual(['w1']);
  });
});

describe('withWidgetKeys', () => {
  const dbWith = (widgets, calls = []) => ({
    from: () => {
      const b = {
        select: () => b,
        eq: (c, v) => { calls.push([c, v]); return b; },
        in: () => b,
        order: () => Promise.resolve({ data: widgets }),
      };
      return b;
    },
  });

  it('adds missing widget keys from the owner widget configs, newest first', async () => {
    const calls = [];
    const out = await withWidgetKeys({ headline: 'x' }, 'u1', dbWith([
      { type: 'google-reviews', widget_key: 'g-new' },
      { type: 'instagram-feed', widget_key: 'ig' },
      { type: 'google-reviews', widget_key: 'g-old' },
    ], calls));
    expect(out).toEqual({ headline: 'x', googleWidgetKey: 'g-new', instagramWidgetKey: 'ig' });
    expect(calls).toContainEqual(['user_id', 'u1']);
  });

  it('never replaces keys the copy already has', async () => {
    const out = await withWidgetKeys({ googleWidgetKey: 'mine' }, 'u1', dbWith([{ type: 'google-reviews', widget_key: 'other' }]));
    expect(out.googleWidgetKey).toBe('mine');
  });

  it('returns the copy unchanged when the lookup fails', async () => {
    const copy = { headline: 'x' };
    const db = { from: () => { throw new Error('offline'); } };
    expect(await withWidgetKeys(copy, 'u1', db)).toBe(copy);
  });
});
