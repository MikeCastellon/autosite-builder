import { describe, it, expect } from 'vitest';
import { normalizeCopy, parseCopyMessage, parseCopyText, CopyResponseError } from './normalizeCopy.js';

const biz = {
  businessName: 'Shine Co',
  businessType: 'detailing_shop',
  city: 'Austin',
  state: 'TX',
  services: [
    { name: 'Full Detail', price: '199' },
    { name: 'Ceramic Coating' },
    { name: '' },
  ],
};

const fullCopy = {
  headline: 'Austin Detailing Done Right',
  subheadline: 'Showroom shine, every visit.',
  aboutText: 'We started in Austin.\nWe still love cars.',
  servicesSection: {
    intro: 'Everything your car needs.',
    items: [{ name: 'Full Detail', description: 'Inside and out.' }],
  },
  ctaPrimary: 'Book Now',
  ctaSecondary: 'See Services',
  ctaHeadline: 'Ready for a Cleaner Car?',
  ctaSubtext: 'Call or book online in Austin.',
  testimonialPlaceholders: [{ text: 'Great work.', name: 'Sam P.' }],
  metaTitle: 'Shine Co | Austin',
  metaDescription: 'Shine Co in Austin.',
  keywords: ['austin detailing'],
  footerTagline: 'Serving Austin',
  schemaType: 'AutoRepair',
  googleWidgetKey: 'gw_1',
  hiddenSections: ['gallery'],
  sectionOrder: ['hero', 'services'],
};

const KEYS = [
  'headline', 'subheadline', 'aboutText', 'servicesSection', 'ctaPrimary', 'ctaSecondary',
  'ctaHeadline', 'ctaSubtext', 'testimonialPlaceholders', 'metaTitle', 'metaDescription', 'keywords',
  'footerTagline',
];

describe('normalizeCopy', () => {
  it('leaves complete, well-typed copy unchanged (extra keys pass through)', () => {
    expect(normalizeCopy(fullCopy, biz)).toEqual(fullCopy);
  });

  it('is idempotent', () => {
    const once = normalizeCopy({ headline: 5, keywords: 'a, b', servicesSection: 'x' }, biz);
    expect(normalizeCopy(once, biz)).toEqual(once);
  });

  it('guarantees every key with the right type for anything the model returns', () => {
    for (const input of [undefined, null, 'oops', 42, [], {}]) {
      const out = normalizeCopy(input, biz);
      for (const key of KEYS) expect(out).toHaveProperty(key);
      expect(typeof out.headline).toBe('string');
      expect(typeof out.aboutText).toBe('string');
      expect(typeof out.ctaHeadline).toBe('string');
      expect(typeof out.ctaSubtext).toBe('string');
      expect(typeof out.servicesSection.intro).toBe('string');
      expect(Array.isArray(out.servicesSection.items)).toBe(true);
      expect(Array.isArray(out.testimonialPlaceholders)).toBe(true);
      expect(Array.isArray(out.keywords)).toBe(true);
    }
  });

  it('fills missing keys only from what the owner entered', () => {
    const out = normalizeCopy({}, biz);
    expect(out.headline).toBe('Shine Co in Austin');
    expect(out.subheadline).toBe('Auto detailing in Austin, TX');
    expect(out.aboutText).toBe('');
    expect(out.servicesSection).toEqual({
      intro: '',
      items: [
        { name: 'Full Detail', description: '' },
        { name: 'Ceramic Coating', description: '' },
      ],
    });
    expect(out.ctaPrimary).toBe('Contact Us');
    expect(out.ctaSecondary).toBe('View Services');
    // Empty = the template's own contact heading and lead.
    expect(out.ctaHeadline).toBe('');
    expect(out.ctaSubtext).toBe('');
    expect(out.testimonialPlaceholders).toEqual([]); // never invented
    expect(out.metaTitle).toBe('Shine Co | Auto detailing in Austin, TX');
    expect(out.metaDescription).toBe('Shine Co offers Full Detail, Ceramic Coating in Austin, TX.');
    expect(out.keywords).toEqual([]);
    expect(out.footerTagline).toBe('Serving Austin, TX');
  });

  it('prefers the owner service area for the footer and copes with sparse info', () => {
    expect(normalizeCopy({}, { ...biz, serviceArea: 'Greater Austin' }).footerTagline).toBe('Serving Greater Austin');
    const bare = normalizeCopy({}, { businessName: 'Solo' });
    expect(bare.headline).toBe('Solo');
    expect(bare.subheadline).toBe('');
    expect(bare.metaTitle).toBe('Solo | Auto Service');
    expect(bare.metaDescription).toBe('Solo.');
    expect(bare.footerTagline).toBe('');
    expect(normalizeCopy({}, null).headline).toBe('');
  });

  it('builds service items from a comma-separated services string', () => {
    const out = normalizeCopy({}, { ...biz, services: 'Tint, PPF ; Ceramic' });
    expect(out.servicesSection.items.map((i) => i.name)).toEqual(['Tint', 'PPF', 'Ceramic']);
  });

  it('replaces blank or wrongly typed strings, keeps written ones as-is', () => {
    const out = normalizeCopy({ headline: '   ', subheadline: { a: 1 }, ctaPrimary: 7, metaTitle: '  Kept  ' }, biz);
    expect(out.headline).toBe('Shine Co in Austin');
    expect(out.subheadline).toBe('Auto detailing in Austin, TX');
    expect(out.ctaPrimary).toBe('7');
    expect(out.metaTitle).toBe('  Kept  ');
  });

  it('cleans service items: strings become items, nameless and junk entries drop, extra fields stay', () => {
    const out = normalizeCopy({
      servicesSection: {
        title: 'Our Work',
        items: ['Wash', { name: 'Wax', description: 3, price: '$50' }, { description: 'no name' }, null, 12],
      },
    }, biz);
    expect(out.servicesSection).toEqual({
      title: 'Our Work',
      intro: '',
      items: [
        { name: 'Wash', description: '' },
        { name: 'Wax', description: '3', price: '$50' },
      ],
    });
  });

  it('keeps an explicit empty services list empty', () => {
    expect(normalizeCopy({ servicesSection: { items: [] } }, biz).servicesSection.items).toEqual([]);
  });

  it('cleans testimonials and keywords', () => {
    const out = normalizeCopy({
      testimonialPlaceholders: [{ text: 'Nice', name: null }, { text: '  ', name: 'Blank' }, 'Loved it', 5],
      keywords: 'austin detailing, , ceramic austin',
    }, biz);
    expect(out.testimonialPlaceholders).toEqual([
      { text: 'Nice', name: '' },
      { text: 'Loved it', name: '' },
    ]);
    expect(out.keywords).toEqual(['austin detailing', 'ceramic austin']);
    expect(normalizeCopy({ keywords: ['a', 3, null, ' b '] }, biz).keywords).toEqual(['a', '3', 'b']);
  });

  it('accepts old copy without the contact band keys and cleans wrongly typed ones', () => {
    const old = { ...fullCopy };
    delete old.ctaHeadline;
    delete old.ctaSubtext;
    const out = normalizeCopy(old, biz);
    expect(out).toEqual({ ...old, ctaHeadline: '', ctaSubtext: '' });
    expect(normalizeCopy({ ctaHeadline: ['x'], ctaSubtext: 12 }, biz)).toMatchObject({ ctaHeadline: '', ctaSubtext: '12' });
  });

  it('does not mutate its input', () => {
    const input = { servicesSection: { items: ['Wash'] } };
    normalizeCopy(input, biz);
    expect(input).toEqual({ servicesSection: { items: ['Wash'] } });
  });
});

describe('parseCopyMessage', () => {
  const msg = (content, stop_reason = 'end_turn') => ({ content, stop_reason });

  it('reads the first text block, skipping a leading thinking block', () => {
    const out = parseCopyMessage(msg([
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '{"headline":"Hi"}' },
    ]));
    expect(out).toEqual({ headline: 'Hi' });
  });

  it('refuses truncated output with code max_tokens', () => {
    try {
      parseCopyMessage(msg([{ type: 'text', text: '{"headline":"Hi", "servi' }], 'max_tokens'));
      throw new Error('expected a throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CopyResponseError);
      expect(err.code).toBe('max_tokens');
    }
  });

  it('joins a partial answer with the fallback model\'s continuation', () => {
    const out = parseCopyMessage(msg([
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '{"headline":"Hi",' },
      { type: 'fallback', from: { model: 'claude-opus-5' }, to: { model: 'claude-opus-4-8' } },
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '"aboutText":"About"}' },
    ]));
    expect(out).toEqual({ headline: 'Hi', aboutText: 'About' });
  });

  it('reads a complete answer after a fallback block when the parts do not join', () => {
    const out = parseCopyMessage(msg([
      { type: 'text', text: '{"headline":"Half' },
      { type: 'fallback', from: { model: 'claude-opus-5' }, to: { model: 'claude-opus-4-8' } },
      { type: 'text', text: '{"headline":"Whole"}' },
    ]));
    expect(out).toEqual({ headline: 'Whole' });
  });

  it('reports a refusal and a response without text', () => {
    expect(() => parseCopyMessage(msg([], 'refusal'))).toThrow(expect.objectContaining({ code: 'refusal' }));
    expect(() => parseCopyMessage(msg([{ type: 'thinking', thinking: '' }]))).toThrow(expect.objectContaining({ code: 'no_text' }));
    expect(() => parseCopyMessage(undefined)).toThrow(expect.objectContaining({ code: 'no_text' }));
  });
});

describe('parseCopyText', () => {
  it('accepts plain JSON, fenced JSON and JSON wrapped in prose', () => {
    expect(parseCopyText('{"a":1}')).toEqual({ a: 1 });
    expect(parseCopyText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseCopyText('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseCopyText('Here you go:\n{"a":{"b":2}}\nEnjoy!')).toEqual({ a: { b: 2 } });
  });

  it('rejects broken JSON and non-objects with code bad_json', () => {
    for (const text of ['{"a":', '[1,2]', '"str"', '', null]) {
      expect(() => parseCopyText(text)).toThrow(expect.objectContaining({ code: 'bad_json' }));
    }
  });
});
