// Footer builder: how a saved copy.footer reads as columns, the cleaned
// object each change writes, and the panel's controls. Node environment (no
// DOM): the panel is checked with renderToStaticMarkup.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FooterBuilderPanel from './FooterBuilderPanel.jsx';
import {
  FOOTER_TYPES, footerColumns, isDefaultColumns, withColumns, setColumn, moveColumn, setFooterField, hoursMerged, emptyColumns,
} from './footerBuilder.js';
import * as kit from '../templates/kit/content.js';

const DEFAULT = FOOTER_TYPES.map((type) => ({ type, title: '', show: true }));
const noop = () => {};
const html = (props) => renderToStaticMarkup(createElement(FooterBuilderPanel, { setCopy: noop, ...props }));

describe('footerColumns', () => {
  it('without a footer or a columns array is the design default', () => {
    expect(footerColumns(undefined)).toEqual(DEFAULT);
    expect(footerColumns(null)).toEqual(DEFAULT);
    expect(footerColumns('junk')).toEqual(DEFAULT);
    expect(footerColumns({ ctaText: 'Book' })).toEqual(DEFAULT);
    expect(footerColumns({ columns: 'brand,links' })).toEqual(DEFAULT);
  });

  it('keeps the owner order; the first entry of a type wins; unknown entries are skipped', () => {
    const cols = footerColumns({
      columns: [
        { type: 'contact', title: 'Call Us' },
        { type: 'mystery' },
        null,
        { type: 'brand', show: false },
        { type: 'contact', title: 'Second', show: false },
        { type: 'hours', title: 7 },
        { type: 'areas', title: { x: 1 } },
        { type: 'links', show: 'yes' },
        { type: 'areas' },
      ],
    });
    expect(cols).toEqual([
      { type: 'contact', title: 'Call Us', show: true },
      { type: 'brand', title: '', show: false },
      { type: 'hours', title: '7', show: true },
      { type: 'areas', title: '', show: true },
      { type: 'links', title: '', show: true },
    ]);
  });

  it('appends the types a saved array leaves out, hidden', () => {
    expect(footerColumns({ columns: [{ type: 'hours' }, { type: 'brand' }] })).toEqual([
      { type: 'hours', title: '', show: true },
      { type: 'brand', title: '', show: true },
      { type: 'links', title: '', show: false },
      { type: 'areas', title: '', show: false },
      { type: 'contact', title: '', show: false },
    ]);
    expect(footerColumns({ columns: [] }).every((c) => !c.show)).toBe(true);
  });
});

// The template renders copy.footer through the kit's footerColumnsOf; the
// panel must list exactly what the page shows (titles compared trimmed: the
// panel keeps them as typed, the kit trims).
describe('footerColumns reads copy.footer like the template kit', () => {
  const SAMPLES = [
    undefined, null, 'junk', [], {}, { columns: 'x' }, { columns: [] }, { ctaText: 'Book' },
    { columns: [{ type: 'hours' }, { type: 'brand', show: false }] },
    { columns: [{ type: 'contact', title: ' Call Us ' }, { type: 'contact', title: 'B' }, { type: 'nope' }, null, ['links'], { type: 'links', show: 0 }] },
    { columns: [{ type: 'areas', title: 12 }, { type: 'links', show: undefined }, { type: 'hours', show: false }] },
    withColumns(null, [...DEFAULT].reverse()),
  ];
  (kit.footerColumnsOf ? it : it.skip)('gives the same columns for every sample', () => {
    const trimmed = (cols) => cols.map((c) => ({ ...c, title: c.title.trim() }));
    for (const footer of SAMPLES) expect({ footer, cols: trimmed(footerColumns(footer)) }).toEqual({ footer, cols: kit.footerColumnsOf(footer) });
    expect(kit.FOOTER_COLUMN_TYPES).toEqual(FOOTER_TYPES);
  });
});

describe('isDefaultColumns / withColumns', () => {
  it('knows the design default', () => {
    expect(isDefaultColumns(DEFAULT)).toBe(true);
    expect(isDefaultColumns(DEFAULT.map((c, i) => (i === 1 ? { ...c, title: '  ' } : c)))).toBe(true);
    expect(isDefaultColumns(DEFAULT.map((c, i) => (i === 1 ? { ...c, title: 'Pages' } : c)))).toBe(false);
    expect(isDefaultColumns(DEFAULT.map((c, i) => (i === 4 ? { ...c, show: false } : c)))).toBe(false);
    expect(isDefaultColumns([...DEFAULT].reverse())).toBe(false);
    expect(isDefaultColumns(DEFAULT.slice(1))).toBe(false);
    expect(isDefaultColumns(null)).toBe(false);
  });

  it('drops default columns and keeps the other keys', () => {
    expect(withColumns({ columns: [{ type: 'hours' }], ctaText: 'Book' }, DEFAULT)).toEqual({ ctaText: 'Book' });
    expect(withColumns({ columns: [{ type: 'hours' }] }, DEFAULT)).toBeNull();
    expect(withColumns(null, DEFAULT)).toBeNull();
  });

  it('stores all five columns with a title only where one is typed', () => {
    const cols = [{ type: 'links', title: 'Pages', show: true }, ...DEFAULT.filter((c) => c.type !== 'links')];
    expect(withColumns({ bottomText: 'Licensed' }, cols)).toEqual({
      bottomText: 'Licensed',
      columns: [
        { type: 'links', title: 'Pages', show: true },
        { type: 'brand', show: true },
        { type: 'areas', show: true },
        { type: 'contact', show: true },
        { type: 'hours', show: true },
      ],
    });
  });
});

describe('setColumn / moveColumn', () => {
  it('switches a column off and back to the default', () => {
    const off = setColumn(null, 'areas', { show: false });
    expect(off.columns).toHaveLength(5);
    expect(off.columns.find((c) => c.type === 'areas')).toEqual({ type: 'areas', show: false });
    expect(footerColumns(off).map((c) => c.type)).toEqual(FOOTER_TYPES);
    expect(setColumn(off, 'areas', { show: true })).toBeNull();
  });

  it('sets and clears a title', () => {
    const titled = setColumn({ ctaText: 'Book' }, 'contact', { title: 'Call Us' });
    expect(titled.ctaText).toBe('Book');
    expect(titled.columns.find((c) => c.type === 'contact')).toEqual({ type: 'contact', title: 'Call Us', show: true });
    expect(setColumn(titled, 'contact', { title: '' })).toEqual({ ctaText: 'Book' });
  });

  it('moves columns and ignores moves out of range', () => {
    const moved = moveColumn(null, 4, 0);
    expect(footerColumns(moved).map((c) => c.type)).toEqual(['hours', 'brand', 'links', 'areas', 'contact']);
    expect(moveColumn(moved, 0, 4)).toBeNull();
    expect(moveColumn(null, 0, 9)).toBeNull();
    expect(moveColumn(moved, 2, 2)).toEqual(moved);
  });

  it('never mutates the saved footer', () => {
    const saved = { columns: [{ type: 'hours' }, { type: 'brand' }], ctaText: 'Book' };
    const snapshot = structuredClone(saved);
    setColumn(saved, 'hours', { title: 'Open' });
    moveColumn(saved, 0, 1);
    setFooterField(saved, 'ctaText', '');
    expect(saved).toEqual(snapshot);
  });
});

describe('setFooterField', () => {
  it('stores showCta only when false', () => {
    const off = setFooterField(null, 'showCta', false);
    expect(off).toEqual({ showCta: false });
    expect(setFooterField(off, 'showCta', true)).toBeNull();
    expect(setFooterField({ ctaText: 'Go', showCta: false }, 'showCta', true)).toEqual({ ctaText: 'Go' });
  });

  it('removes an emptied text field and returns null when nothing is left', () => {
    expect(setFooterField(null, 'ctaText', 'Book Now')).toEqual({ ctaText: 'Book Now' });
    expect(setFooterField({ ctaText: 'Book Now', bottomText: 'Licensed' }, 'ctaText', '')).toEqual({ bottomText: 'Licensed' });
    expect(setFooterField({ ctaUrl: 'https://x.test' }, 'ctaUrl', '')).toBeNull();
    // Unknown keys change nothing.
    expect(setFooterField({ bottomText: 'Licensed' }, 'evil', 'x')).toEqual({ bottomText: 'Licensed' });
  });
});

describe('hoursMerged', () => {
  const col = (type, show = true) => ({ type, title: '', show });
  it('is true only when the shown hours come right after the shown contact column', () => {
    expect(hoursMerged([col('contact'), col('hours')])).toBe(true);
    expect(hoursMerged([col('contact'), col('links', false), col('hours')])).toBe(true);
    expect(hoursMerged([col('hours'), col('contact')])).toBe(false);
    expect(hoursMerged([col('contact', false), col('hours')])).toBe(false);
    expect(hoursMerged([col('contact'), col('areas'), col('hours')])).toBe(false);
    expect(hoursMerged(DEFAULT)).toBe(true);
    expect(hoursMerged(null)).toBe(false);
  });
});

describe('FooterBuilderPanel', () => {
  it('lists five columns with a switch each and titles only for shown non-brand columns', () => {
    const out = html({ copy: { footer: setColumn(null, 'areas', { show: false }) } });
    expect(out.match(/role="switch"/g)).toHaveLength(5 + 1); // + Show the button
    for (const label of ['Logo &amp; tagline', 'Explore links', 'Areas served', 'Get in touch', 'Hours']) {
      expect(out).toContain(`aria-label="Show ${label}"`);
    }
    expect(out).toContain('aria-label="Explore links title"');
    expect(out).toContain('aria-label="Get in touch title"');
    expect(out).toContain('aria-label="Hours title"');
    expect(out).not.toContain('aria-label="Logo &amp; tagline title"');
    expect(out).not.toContain('aria-label="Areas served title"');
    expect(out).toMatch(/aria-label="Explore links title"[^>]*maxLength="30"|maxLength="30"[^>]*aria-label="Explore links title"/);
    expect(out).toContain('placeholder="Title (default: Get In Touch)"');
    expect(out).toContain('Shown under Get in touch, because it comes right after it.');
  });

  it('says when hours stand alone', () => {
    expect(html({ copy: { footer: moveColumn(null, 4, 0) } })).toContain('Shown as its own column.');
  });

  it('hides the button fields when the button is off', () => {
    const on = html({ copy: { footer: { ctaText: 'Book Now' } } });
    expect(on).toContain('value="Book Now"');
    expect(on).toContain('Leave empty for your booking form');
    const off = html({ copy: { footer: { showCta: false } } });
    expect(off).not.toContain('Button text');
    expect(off).not.toContain('Leave empty for your booking form');
    expect(off).toContain('Bottom line');
  });

  it('warns that the button hides with the Get in touch column', () => {
    expect(html({ copy: { footer: setColumn(null, 'contact', { show: false }) } })).toContain('Get in touch is switched off above, so the button is hidden.');
    expect(html({ copy: {} })).not.toContain('switched off above');
  });

  it('points at the Google Rating tab only when the template has it', () => {
    expect(html({ copy: {}, hasGoogleTab: true })).toContain('Edit &gt; Google Rating.');
    expect(html({ copy: {} })).not.toContain('Google Rating');
  });

  it('says which tab fills an empty column, and that the rating sits in the logo column', () => {
    const bare = html({ copy: {}, businessInfo: { businessName: 'X' } });
    expect(bare).toContain('No hours yet: add them in Edit &gt; Business Info.');
    expect(bare).toContain('Nothing to list yet: add your city or areas in Edit &gt; Business Info.');
    expect(bare).toContain('Nothing to list yet: add a phone, email or social link in Edit &gt; Business Info.');
    const filled = html({ copy: {}, businessInfo: { city: 'Orlando', phone: '1', hours: { Mon: '9am-5pm' } } });
    expect(filled).not.toContain('Nothing to list yet');
    expect(filled).not.toContain('No hours yet');
    expect(html({ copy: {}, hasGoogleTab: true })).toContain('Switched off, the rating moves to the bottom line.');
    expect(emptyColumns({ hours: 'Mon-Fri 9-5', serviceArea: 'Orlando', email: 'a@b.c' })).toEqual(new Set());
  });

  it('flags a button link that will not work', () => {
    expect(html({ copy: { footer: { ctaUrl: 'book now' } } })).toContain('Start the link with https://');
    expect(html({ copy: { footer: { ctaUrl: 'calendly.com/x' } } })).not.toContain('Start the link with');
  });

  it('offers the reset link only when a footer is saved', () => {
    expect(html({ copy: {} })).not.toContain('Use the design&#x27;s footer');
    expect(html({ copy: { footer: { bottomText: 'Licensed' } } })).toContain('Use the design&#x27;s footer');
  });
});
