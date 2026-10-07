import { describe, it, expect } from 'vitest';
import { FEATURE_IDS, OUTLINE_VERSION, SECTION_KINDS, SECTION_LAYOUTS, outlineFonts, sanitizeOutline } from './referenceOutline.js';

const EMPTY = {
  v: 1, title: '', width: 0, stickyHeader: false, fonts: { heading: null, body: null, button: null },
  sections: [], nav: { items: 0, labels: [], cta: '' }, spacing: { sectionGap: 0 }, features: [],
};

// What PAGE_SCRIPTS.outline gives for a typical detailer's page.
const GOOD = {
  v: 1,
  title: 'Shine Auto Detailing | Tampa',
  width: 1200,
  stickyHeader: true,
  fonts: {
    heading: { family: 'Poppins', weight: 800, size: 64 },
    body: { family: 'Inter', weight: 400, size: 17.5 },
    button: { family: 'Poppins', weight: 600, size: 16, uppercase: true, radius: 999 },
  },
  sections: [
    { kind: 'header', heading: '', height: 80, layout: '', cards: 0 },
    { kind: 'hero', heading: 'Showroom shine, at your door', height: 720, layout: 'full', cards: 0 },
    { kind: 'services', heading: 'Our Services', height: 601, layout: 'grid-3', cards: 3 },
    { kind: 'footer', heading: '', height: 240, layout: 'grid-4', cards: 4 },
  ],
  nav: { items: 5, labels: ['Services', 'Gallery', 'FAQ', 'Contact'], cta: 'Book Now' },
  spacing: { sectionGap: 192 },
  features: [{ id: 'sticky-header', provider: '' }, { id: 'booking-widget', provider: 'Calendly' }, { id: 'contact-form', provider: '' }],
};

const NUL = String.fromCharCode(0);
const LINE_SEP = String.fromCharCode(0x2028);
const ZERO_WIDTH = String.fromCharCode(0x200b);

describe('the outline vocabulary', () => {
  it('names version 1, the 21 features, the section kinds and the layouts, frozen', () => {
    expect(OUTLINE_VERSION).toBe(1);
    expect(FEATURE_IDS).toEqual([
      'sticky-header', 'hero-video', 'hero-slider', 'carousel', 'gallery', 'before-after', 'reviews', 'reviews-widget', 'faq',
      'tabs', 'pricing', 'booking-widget', 'quote-form', 'contact-form', 'map', 'video', 'instagram-feed', 'chat', 'stats',
      'newsletter', 'service-area',
    ]);
    expect(SECTION_KINDS).toEqual([
      'header', 'hero', 'services', 'pricing', 'gallery', 'reviews', 'faq', 'about', 'process', 'stats', 'contact', 'booking',
      'cta', 'footer', 'other',
    ]);
    expect(SECTION_LAYOUTS).toEqual(['full', 'split', 'grid-2', 'grid-3', 'grid-4', 'list', 'carousel', '']);
    for (const list of [FEATURE_IDS, SECTION_KINDS, SECTION_LAYOUTS]) expect(Object.isFrozen(list)).toBe(true);
  });
});

describe('sanitizeOutline', () => {
  it('is null for anything but an object of this version', () => {
    for (const v of [null, undefined, '', 'outline', 42, NaN, true, [], [GOOD], () => GOOD]) expect(sanitizeOutline(v), String(v)).toBe(null);
    expect(sanitizeOutline({ ...GOOD, v: 2 })).toBe(null);
    expect(sanitizeOutline({ ...GOOD, v: '1' })).toBe(null);
  });

  it('gives the whole shape, empty, for an empty object (v may be left out)', () => {
    expect(sanitizeOutline({})).toEqual(EMPTY);
    expect(sanitizeOutline({ v: 1 })).toEqual(EMPTY);
  });

  it('keeps a good outline exactly as it is', () => {
    expect(sanitizeOutline(GOOD)).toEqual(GOOD);
  });

  it('turns junk into the shape: unknown keys out, text on one line, numbers finite and clamped', () => {
    const out = sanitizeOutline({
      v: 1,
      title: `  Shine\n\tAuto${NUL} Deta${ZERO_WIDTH}iling${LINE_SEP} `,
      width: '1200.4',
      stickyHeader: 'yes',
      colors: { accent: '#ff0000' },
      images: ['https://shop.example/hero.jpg'],
      fonts: {
        heading: { family: '"Poppins", sans-serif', weight: 1200, size: 4, color: '#ff0000' },
        body: { family: '', weight: 400, size: 16 },
        button: { family: 'Inter', weight: 'bold', size: '15.25', uppercase: 'true', radius: -4, background: 'red' },
        eyebrow: { family: 'Lato' },
      },
      sections: [
        { kind: 'hero', heading: 'Line one\nline two', height: 1e9, layout: 'masonry', cards: 999, color: '#000' },
        { kind: 'nope', heading: 42, height: -5, layout: 'grid-3', cards: 2.6 },
        { kind: 'faq', height: Infinity, cards: NaN },
        'not a section', null, [], 7,
      ],
      nav: { items: -3, labels: ['Home', '', 'Home', 42, 'Services\n', 'x'.repeat(50), null], cta: { label: 'Book' } },
      spacing: { sectionGap: 999, padding: 80 },
      features: [{ id: 'faq', provider: 'Acme' }, { id: 'teleporter', provider: 'X' }, 'map', { id: 'faq', provider: 'Second' }, { id: 'chat', provider: { name: 'x' } }, null, 3],
    });
    expect(out).toEqual({
      v: 1,
      title: 'Shine Auto Detailing',
      width: 1200,
      stickyHeader: false,
      fonts: {
        heading: { family: 'Poppins', weight: 900, size: 8 },
        body: null,
        button: { family: 'Inter', weight: 400, size: 15.3, uppercase: false, radius: 0 },
      },
      sections: [
        { kind: 'hero', heading: 'Line one line two', height: 20000, layout: '', cards: 50 },
        { kind: 'other', heading: '', height: 0, layout: 'grid-3', cards: 3 },
        { kind: 'faq', heading: '', height: 0, layout: '', cards: 0 },
      ],
      nav: { items: 3, labels: ['Home', 'Services', 'x'.repeat(30)], cta: '' },
      spacing: { sectionGap: 400 },
      features: [{ id: 'faq', provider: 'Acme' }, { id: 'map', provider: '' }, { id: 'chat', provider: '' }],
    });
  });

  it('caps every text and list', () => {
    const out = sanitizeOutline({
      title: 'T'.repeat(500),
      width: 9999,
      fonts: { heading: { family: 'F'.repeat(100), weight: 50, size: 300 } },
      sections: Array.from({ length: 50 }, (_, i) => ({ kind: 'other', heading: `H${i}`.padEnd(200, 'h'), height: 100, layout: 'list', cards: 1 })),
      nav: { items: 500, labels: Array.from({ length: 40 }, (_, i) => `Item ${i}`), cta: 'C'.repeat(90) },
      features: [...FEATURE_IDS].reverse().map((id) => ({ id, provider: 'P'.repeat(100) })).concat(FEATURE_IDS.map((id) => ({ id }))),
    });
    expect(out.title).toBe('T'.repeat(120));
    expect(out.width).toBe(3000);
    expect(out.fonts.heading).toEqual({ family: 'F'.repeat(60), weight: 100, size: 200 });
    expect(out.sections).toHaveLength(30);
    expect(out.sections[0].heading).toBe('H0'.padEnd(80, 'h'));
    expect(out.nav.labels).toEqual(Array.from({ length: 12 }, (_, i) => `Item ${i}`));
    expect(out.nav.items).toBe(50);
    expect(out.nav.cta).toBe('C'.repeat(30));
    // Each feature once, in FEATURE_IDS order, its first provider capped.
    expect(out.features.map((f) => f.id)).toEqual([...FEATURE_IDS]);
    expect(out.features.every((f) => f.provider === 'P'.repeat(40))).toBe(true);
    // Never half an emoji.
    const cars = sanitizeOutline({ title: '🚗'.repeat(200) }).title;
    expect(Array.from(cars)).toEqual(Array(120).fill('🚗'));
    expect(() => encodeURIComponent(cars)).not.toThrow();
  });

  it('drops unknown features and keeps the sticky header flag and feature in step', () => {
    expect(sanitizeOutline({ features: [{ id: 'teleporter' }, { id: 'Chat' }, { id: ' faq' }, { provider: 'Calendly' }] }).features).toEqual([]);
    expect(sanitizeOutline({ stickyHeader: true })).toMatchObject({ stickyHeader: true, features: [{ id: 'sticky-header', provider: '' }] });
    expect(sanitizeOutline({ features: ['map', 'sticky-header'] })).toMatchObject({
      stickyHeader: true, features: [{ id: 'sticky-header', provider: '' }, { id: 'map', provider: '' }],
    });
  });

  it('never keeps a web address, whatever field the page put it in', () => {
    const out = sanitizeOutline({
      title: 'Visit https://shop.example/promo?x=1 today',
      sections: [{ kind: 'gallery', heading: 'See www.shop.example and data:image/png;base64,AAAA', height: 10 }],
      nav: { labels: ['http://evil.example/x', 'Shop'], cta: 'blob:https://x.example/y Book' },
      fonts: { body: { family: 'url(https://fonts.example/a.woff2)' } },
      features: [{ id: 'map', provider: 'https://maps.example' }],
    });
    expect(out.title).toBe('Visit today');
    expect(out.sections[0].heading).toBe('See and');
    expect(out.nav).toEqual({ items: 1, labels: ['Shop'], cta: 'Book' });
    expect(out.features).toEqual([{ id: 'map', provider: '' }]);
    expect(JSON.stringify(out)).not.toMatch(/https?:|www\.|data:|blob:/);
  });

  it('names a family next/font renamed after the one it loads', () => {
    const out = sanitizeOutline({ fonts: { heading: { family: '__Inter_d65c78', weight: 700, size: 48 }, body: { family: '__Space_Grotesk_Fallback_6c6f8a' } } });
    expect(out.fonts.heading).toEqual({ family: 'Inter', weight: 700, size: 48 });
    expect(out.fonts.body).toEqual({ family: 'Space Grotesk', weight: 400, size: 16 });
  });

  it('gives the same answer run again on its own output, and survives JSON', () => {
    const junk = { ...GOOD, title: ` ${GOOD.title}\n`, sections: [...GOOD.sections, { kind: 'x', height: '12.7' }], extra: 1 };
    const once = sanitizeOutline(junk);
    expect(sanitizeOutline(once)).toEqual(once);
    expect(JSON.parse(JSON.stringify(once))).toEqual(once);
    expect(sanitizeOutline(GOOD)).not.toBe(GOOD);
  });
});

describe('outlineFonts', () => {
  it('names the heading and body families, or empty strings', () => {
    expect(outlineFonts(GOOD)).toEqual({ heading: 'Poppins', body: 'Inter' });
    expect(outlineFonts({ fonts: { heading: { family: "'Bebas Neue', sans-serif" }, body: 'Inter' } })).toEqual({ heading: 'Bebas Neue', body: '' });
    expect(outlineFonts({ fonts: { body: { family: '__Inter_d65c78' } } })).toEqual({ heading: '', body: 'Inter' });
    for (const v of [null, undefined, 'x', [], {}, { fonts: [] }]) expect(outlineFonts(v)).toEqual({ heading: '', body: '' });
  });
});
