// Headings tab: which rows and fields it lists, where each field reads and
// writes, the cleaned sectionTitles it stores and the live accent check.
// Node environment (no DOM): the panel is checked with renderToStaticMarkup.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeadingsPanel from './HeadingsPanel.jsx';
import { HEADING_KEYS, FROM_LABELS, headingRows, getPath, headingValue, setSectionTitle, accentStatus, emptyAccentText } from './sectionHeadings.js';
import * as redline from '../templates/mobile/MobileRedline.jsx';

// Shaped like mobile_redline's headingFields export.
const HEADING_FIELDS = {
  hero: { fields: ['eyebrow', 'title', 'accent'], titleFrom: 'headline' },
  services: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'servicesSection.title', introFrom: 'servicesSection.intro', placeholder: { eyebrow: 'Service Menu' } },
  cta: { fields: ['title', 'accent', 'intro'], titleFrom: 'ctaHeadline', introFrom: 'ctaSubtext' },
  brands: { fields: ['eyebrow'] },
};
const SECTIONS = [
  { id: 'hero', label: 'Hero & Quote' },
  { id: 'about', label: 'About' },
  { id: 'brands', label: 'Vehicle Makes' },
  { id: 'services', label: 'Packages' },
  { id: 'cta', label: 'Contact / CTA' },
];
const noop = () => {};
const html = (props) => renderToStaticMarkup(createElement(HeadingsPanel, { setCopy: noop, sections: SECTIONS, headingFields: HEADING_FIELDS, ...props }));

describe('headingRows', () => {
  it('follows the section order and skips ids the template does not name', () => {
    const rows = headingRows(SECTIONS, HEADING_FIELDS);
    expect(rows.map((r) => r.id)).toEqual(['hero', 'brands', 'services', 'cta']);
    expect(rows[0]).toEqual({ id: 'hero', label: 'Hero & Quote', fields: ['eyebrow', 'title', 'accent'], titleFrom: 'headline', introFrom: null, placeholder: {}, generic: false });
    expect(rows.find((r) => r.id === 'services')).toMatchObject({ titleFrom: 'servicesSection.title', introFrom: 'servicesSection.intro', placeholder: { eyebrow: 'Service Menu' } });
    // Reordered sections reorder the rows.
    expect(headingRows([...SECTIONS].reverse(), HEADING_FIELDS).map((r) => r.id)).toEqual(['cta', 'services', 'brands', 'hero']);
  });

  it('filters unknown fields, drops an unknown owner key and skips rows left empty', () => {
    const rows = headingRows(SECTIONS, {
      hero: { fields: ['eyebrow', 'subtitle', 'title', 'title'], titleFrom: 'tagline', introFrom: 'headline' },
      about: { fields: ['nope'] },
      cta: 'not an object',
    });
    expect(rows.map((r) => r.id)).toEqual(['hero']);
    expect(rows[0].fields).toEqual(['eyebrow', 'title']);
    expect(rows[0].titleFrom).toBeNull();
    expect(rows[0].introFrom).toBe('headline');
  });

  it('without headingFields lists every section with all four fields', () => {
    const rows = headingRows(SECTIONS, null);
    expect(rows).toHaveLength(SECTIONS.length);
    for (const r of rows) expect(r).toMatchObject({ fields: HEADING_KEYS, generic: true });
    // The precedence rules still apply: these titles are owned elsewhere.
    expect(rows.map((r) => [r.id, r.titleFrom, r.introFrom])).toEqual([
      ['hero', 'headline', null],
      ['about', null, null],
      ['brands', null, null],
      ['services', 'servicesSection.title', 'servicesSection.intro'],
      ['cta', 'ctaHeadline', 'ctaSubtext'],
    ]);
    expect(headingRows(null, null)).toEqual([]);
    expect(headingRows([{ id: '' }, null, { id: 'x' }], null).map((r) => [r.id, r.label])).toEqual([['x', 'x']]);
  });

  // The accent check needs the heading text: a section offering highlighted
  // words must also offer (or own) its heading.
  (redline.headingFields ? it : it.skip)('reads mobile_redline\'s own headingFields', () => {
    const rows = headingRows(redline.sections, redline.headingFields);
    expect(rows.map((r) => r.id)).toEqual(redline.sections.map((s) => s.id).filter((id) => redline.headingFields[id]));
    for (const r of rows) {
      expect({ id: r.id, fields: r.fields }).toEqual({ id: r.id, fields: redline.headingFields[r.id].fields });
      if (r.fields.includes('accent')) expect({ id: r.id, title: r.fields.includes('title') }).toEqual({ id: r.id, title: true });
      if (redline.headingFields[r.id].titleFrom) expect(r.titleFrom).toBe(redline.headingFields[r.id].titleFrom);
      if (redline.headingFields[r.id].introFrom) expect(r.introFrom).toBe(redline.headingFields[r.id].introFrom);
    }
  });

  it('every owner key names a real tab field', () => {
    expect(Object.keys(FROM_LABELS)).toEqual(['headline', 'servicesSection.title', 'servicesSection.intro', 'ctaHeadline', 'ctaSubtext']);
  });
});

describe('headingValue', () => {
  const rows = Object.fromEntries(headingRows(SECTIONS, HEADING_FIELDS).map((r) => [r.id, r]));

  it('reads an owned title / intro from its copy key and the rest from sectionTitles', () => {
    const copy = {
      headline: "Orlando's Most Trusted Detailers",
      servicesSection: { title: 'Our Packages', intro: 'Pick one.' },
      sectionTitles: { hero: { eyebrow: 'Mobile Detailing', title: 'ignored', accent: 'Trusted' }, brands: { eyebrow: 'All Makes' } },
    };
    expect(headingValue(copy, rows.hero, 'title')).toBe("Orlando's Most Trusted Detailers");
    expect(headingValue(copy, rows.hero, 'eyebrow')).toBe('Mobile Detailing');
    expect(headingValue(copy, rows.hero, 'accent')).toBe('Trusted');
    expect(headingValue(copy, rows.services, 'title')).toBe('Our Packages');
    expect(headingValue(copy, rows.services, 'intro')).toBe('Pick one.');
    expect(headingValue(copy, rows.brands, 'eyebrow')).toBe('All Makes');
    expect(headingValue(copy, rows.cta, 'title')).toBe('');
  });

  it('gives an empty string for anything that is not a string', () => {
    const copy = { headline: 42, servicesSection: 'x', sectionTitles: { hero: { eyebrow: ['a'] }, brands: 'x' } };
    expect(headingValue(copy, rows.hero, 'title')).toBe('');
    expect(headingValue(copy, rows.services, 'title')).toBe('');
    expect(headingValue(copy, rows.hero, 'eyebrow')).toBe('');
    expect(headingValue(copy, rows.brands, 'eyebrow')).toBe('');
    expect(headingValue(null, rows.hero, 'accent')).toBe('');
    expect(headingValue({ sectionTitles: 'junk' }, rows.hero, 'accent')).toBe('');
  });

  it('getPath walks dot paths and stops at non-objects', () => {
    expect(getPath({ a: { b: 'c' } }, 'a.b')).toBe('c');
    expect(getPath({ a: 'x' }, 'a.b')).toBeUndefined();
    expect(getPath(null, 'a')).toBeUndefined();
    expect(getPath({ a: 1 }, '')).toBeUndefined();
  });
});

describe('setSectionTitle', () => {
  it('sets a field, keeping the other sections', () => {
    const before = { about: { title: 'Why Us' } };
    expect(setSectionTitle(before, 'hero', 'accent', 'Trusted')).toEqual({ about: { title: 'Why Us' }, hero: { accent: 'Trusted' } });
    expect(setSectionTitle(before, 'about', 'accent', 'Us')).toEqual({ about: { title: 'Why Us', accent: 'Us' } });
  });

  it('keeps what the owner types, including a trailing space mid-word', () => {
    expect(setSectionTitle(null, 'about', 'title', 'Why ')).toEqual({ about: { title: 'Why ' } });
  });

  it('removes an emptied field, an emptied entry and returns null when nothing is left', () => {
    const titles = { about: { title: 'Why Us', accent: 'Us' }, hero: { eyebrow: 'Mobile' } };
    expect(setSectionTitle(titles, 'about', 'accent', '')).toEqual({ about: { title: 'Why Us' }, hero: { eyebrow: 'Mobile' } });
    expect(setSectionTitle({ about: { title: 'Why Us' }, hero: { eyebrow: 'Mobile' } }, 'hero', 'eyebrow', '   ')).toEqual({ about: { title: 'Why Us' } });
    expect(setSectionTitle({ about: { title: 'Why Us' } }, 'about', 'title', '')).toBeNull();
    // Junk saved alongside is cleaned away, never written back.
    expect(setSectionTitle({ x: 'junk', y: { title: '' }, z: { eyebrow: 3 } }, 'about', 'title', '')).toBeNull();
  });

  it('never mutates its input and treats non-objects as empty', () => {
    const titles = { about: { title: 'Why Us' } };
    const snapshot = structuredClone(titles);
    const next = setSectionTitle(titles, 'about', 'title', 'Why Pick Us');
    expect(titles).toEqual(snapshot);
    expect(next.about).not.toBe(titles.about);
    expect(setSectionTitle('junk', 'hero', 'eyebrow', 'Hi')).toEqual({ hero: { eyebrow: 'Hi' } });
    expect(setSectionTitle(['a'], 'hero', 'eyebrow', 'Hi')).toEqual({ hero: { eyebrow: 'Hi' } });
    expect(setSectionTitle(undefined, 'hero', 'eyebrow', null)).toBeNull();
  });
});

describe('accentStatus', () => {
  it('splits the heading around whole words, keeping the heading\'s casing', () => {
    expect(accentStatus('Why Top Choice Is The Right Choice For Your Car', 'right choice')).toEqual({
      tone: 'ok',
      parts: { before: 'Why Top Choice Is The ', match: 'Right Choice', after: ' For Your Car' },
    });
  });

  it('errors when the words are not in the heading, or only inside a word', () => {
    const miss = accentStatus('Why Top Choice Is The Right Choice For Your Car', 'Choice Car');
    expect(miss.tone).toBe('error');
    expect(miss.text).toContain('"Choice Car" isn\'t in the heading');
    expect(accentStatus('Gift Cards Available', 'Car').tone).toBe('error');
  });

  it('warns without a heading and has nothing to say without an accent', () => {
    expect(accentStatus('', 'Trusted')).toEqual({ tone: 'warn', text: 'Type a heading first: highlighted words must be part of it.' });
    expect(accentStatus('Some Heading', '')).toEqual({ tone: null });
    expect(accentStatus('Some Heading', '   ')).toEqual({ tone: null });
    expect(accentStatus(null, undefined)).toEqual({ tone: null });
  });
});

describe('HeadingsPanel', () => {
  it('renders one <details> per row, the first one open, with the section labels', () => {
    const out = html({ copy: {} });
    expect(out.match(/<details/g)).toHaveLength(4);
    expect(out.match(/<details[^>]*\sopen=""/g)).toHaveLength(1);
    expect(out.indexOf('<details')).toBe(out.search(/<details[^>]*\sopen=""/));
    for (const label of ['Hero &amp; Quote', 'Vehicle Makes', 'Packages', 'Contact / CTA']) expect(out).toContain(label);
    expect(out).not.toContain('>About<');
    expect(out).toContain('Leave a field empty to keep the design&#x27;s own text.');
    expect(out).not.toContain('This design may not use every field.');
  });

  it('edits the hero heading at copy.headline and says so', () => {
    const out = html({ copy: { headline: 'Shine On Wheels' } });
    expect(out).toMatch(/id="hd-hero-title"[^>]*value="Shine On Wheels"/);
    expect(out).toContain('Same text as Hero &gt; Headline.');
    expect(out).toContain('Same text as Services &gt; Services Intro.');
    // The collapsed row shows the heading it has now.
    expect(out).toContain('>Shine On Wheels</span>');
    // An eyebrow placeholder from the template, else the generic one.
    expect(out).toMatch(/id="hd-services-eyebrow"[^>]*placeholder="Service Menu"/);
    expect(out).toMatch(/id="hd-hero-eyebrow"[^>]*placeholder="Design&#x27;s label"/);
  });

  it('previews the highlighted words in the heading', () => {
    const out = html({ copy: { headline: "Orlando's Most Trusted Mobile Detailing", sectionTitles: { hero: { accent: 'trusted' } } } });
    expect(out).toContain('Preview: Orlando&#x27;s Most <strong class="text-red-600">Trusted</strong> Mobile Detailing');
  });

  it('shows an error line when the highlighted words are not in the heading', () => {
    const out = html({ copy: { headline: 'Shine On Wheels', sectionTitles: { hero: { accent: 'Trusted' } } } });
    expect(out).toContain('&quot;Trusted&quot; isn&#x27;t in the heading');
    expect(out).toContain('text-red-600');
    expect(out).not.toContain('Preview:');
  });

  it('marks switched-off sections', () => {
    const out = html({ copy: {}, hiddenSections: ['brands'] });
    expect(out).toMatch(/Vehicle Makes<span[^>]*> · switched off<\/span>/);
    expect(out.match(/switched off/g)).toHaveLength(1);
  });

  it('caps sectionTitles text but not text another tab owns', () => {
    const out = html({ copy: {} });
    expect(out).toMatch(/id="hd-brands-eyebrow"[^>]*maxLength="60"/);
    expect(out).not.toMatch(/id="hd-services-intro"[^>]*maxLength/);
  });

  it('without headingFields says some fields may be unused, and waits for sections', () => {
    const generic = html({ copy: {}, headingFields: null });
    expect(generic).toContain('This design may not use every field.');
    expect(generic.match(/<details/g)).toHaveLength(SECTIONS.length);
    expect(html({ copy: {}, sections: [] })).toContain('Loading sections…');
    expect(html({ copy: {}, headingFields: { other: { fields: ['title'] } } })).toContain('This design has no headings to set here.');
  });
});

describe('design defaults (the template\'s headingDefaults)', () => {
  const biz = { businessName: 'Top Choice Mobile Detailing', businessType: 'mobile_detailing', city: 'Orlando', services: [{ name: 'Refresh Detail', price: '$120' }] };
  const full = (props) => renderToStaticMarkup(createElement(HeadingsPanel, {
    setCopy: noop, sections: redline.sections, headingFields: redline.headingFields, headingDefaults: redline.headingDefaults, businessInfo: biz, ...props,
  }));

  it('checks highlighted words against the design heading while the field is empty', () => {
    expect(accentStatus('', 'Right Choice', 'Why Top Choice Is The Right Choice For Your Car')).toEqual({
      tone: 'ok', design: true, parts: { before: 'Why Top Choice Is The ', match: 'Right Choice', after: ' For Your Car' },
    });
    // The owner's own heading wins over the design's.
    expect(accentStatus('Our Story', 'Right Choice', 'Why Top Choice Is The Right Choice For Your Car').tone).toBe('error');
    // A part of a word asks for whole words.
    expect(accentStatus('Trusted Detailers', 'Trust').text).toContain('Use whole words from the heading.');
    expect(emptyAccentText('Every Detail Matters')).toBe('Empty: the design highlights "Every Detail Matters".');
    expect(emptyAccentText('')).toBe('Empty: nothing is highlighted.');
  });

  it('shows the design heading as the placeholder and in the collapsed row', () => {
    const out = full({ copy: {} });
    expect(out).toMatch(/id="hd-about-title"[^>]*placeholder="Why Top Choice Is The Right Choice For Your Car"/);
    expect(out).toContain('>Why Top Choice Is The Right Choice For Your Car</span>');
    expect(out).toMatch(/id="hd-hero-eyebrow"[^>]*placeholder="Orlando Mobile Detailing"/);
    expect(out).toMatch(/id="hd-hero-title"[^>]*placeholder="Top Choice Mobile Detailing"/);
    expect(out).toMatch(/id="hd-locations-title"[^>]*placeholder="Proudly Serving Orlando"/);
    expect(out).toContain('Empty: the design highlights &quot;Right Choice For Your Car&quot;.');
    // The hero has no design highlight.
    expect(out).toContain('Empty: nothing is highlighted.');
  });

  it('previews words of the design heading and rejects words that are not in it', () => {
    const ok = full({ copy: { sectionTitles: { about: { accent: 'right choice' } } } });
    expect(ok).toContain('Preview (the design&#x27;s heading): Why Top Choice Is The <strong class="text-red-600">Right Choice</strong> For Your Car');
    const miss = full({ copy: { sectionTitles: { about: { accent: 'About' } } } });
    expect(miss).toContain('&quot;About&quot; isn&#x27;t in the heading as whole words');
    expect(miss).not.toContain('Type a heading first');
  });

  it('falls back to the generic text when the defaults throw', () => {
    const out = full({ copy: {}, headingDefaults: () => { throw new Error('x'); } });
    expect(out).toMatch(/id="hd-about-title"[^>]*placeholder="Design&#x27;s heading"/);
    expect(out).not.toContain('Empty: ');
  });
});
