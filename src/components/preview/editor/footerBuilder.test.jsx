// Footer builder: how a saved copy.footer reads as columns, the cleaned
// object each change writes, and the panel's controls. Node environment (no
// DOM): the panel is checked with renderToStaticMarkup.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FooterBuilderPanel from './FooterBuilderPanel.jsx';
import {
  FOOTER_TYPES, footerColumns, isDefaultColumns, withColumns, setColumn, moveColumn, setFooterField, footerShowsCta, hoursMerged, emptyColumns,
} from './footerBuilder.js';
import * as kit from '../templates/kit/content.js';
import * as features from '../templates/kit/features.js';
import * as sporty from '../templates/detailing/DetailingSporty.jsx';
import * as chrome from '../templates/mobile/MobileChrome.jsx';
import * as sudsy from '../templates/mobile/MobileSudsy.jsx';
import * as redline from '../templates/mobile/MobileRedline.jsx';

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
    // Redline's footer button keeps the contact column on the page by itself.
    expect(bare).not.toContain('add a phone, email or social link');
    const noButton = html({ copy: { footer: setFooterField(null, 'showCta', false) }, businessInfo: { businessName: 'X' } });
    expect(noButton).toContain('Nothing to list yet: add a phone, email or social link in Edit &gt; Business Info.');
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

// Each template declares its own footer (footerSpec: columns, titles, button
// default). Themes with live sites keep today's footer while copy.footer is
// unset, with extra columns off and the button off; the panel reads and
// writes copy.footer against that spec, the way the kit renders it.
describe('a template footerSpec', () => {
  const SPECS = { sporty: sporty.footerSpec, chrome: chrome.footerSpec, sudsy: sudsy.footerSpec, redline: redline.footerSpec };
  const SAMPLES = [
    undefined, null, {}, { columns: [] }, { showCta: true }, { showCta: false, ctaUrl: 'https://x.test' },
    { columns: [{ type: 'hours' }, { type: 'services', title: ' Menu ' }, { type: 'brand', show: false }] },
    { columns: [{ type: 'contact', title: 'Reach Us' }, { type: 'areas' }, { type: 'nope' }, { type: 'links', show: false }] },
  ];

  it('reads every sample like the kit, and shows a button exactly when the page does', () => {
    const trimmed = (cols) => cols.map((c) => ({ ...c, title: c.title.trim() }));
    for (const [name, spec] of Object.entries(SPECS)) {
      for (const footer of SAMPLES) {
        expect({ name, footer, cols: trimmed(footerColumns(footer, spec)) }).toEqual({ name, footer, cols: kit.footerColumnsOf(footer, spec.columns) });
        const plan = features.footerPlan({ footer, spec, ctaFallback: '#contact' });
        expect({ name, footer, cta: footerShowsCta(footer, spec) }).toEqual({ name, footer, cta: Boolean(plan.cta) });
      }
    }
  });

  it("starts from the design's own columns, and stores nothing for them", () => {
    const spec = SPECS.chrome;
    const cols = footerColumns(null, spec);
    expect(cols.map((c) => [c.type, c.show])).toEqual(spec.columns.map((c) => [c.type, c.show]));
    expect(isDefaultColumns(cols, spec)).toBe(true);
    expect(isDefaultColumns(cols)).toBe(false);
    const on = setColumn(null, 'areas', { show: true }, spec);
    expect(on.columns.find((c) => c.type === 'areas').show).toBe(true);
    expect(setColumn(on, 'areas', { show: false }, spec)).toBeNull();
    expect(footerColumns(null, SPECS.sudsy).map((c) => c.type)).toContain('services');
    expect(footerColumns(null).map((c) => c.type)).not.toContain('services');
  });

  it('stores showCta only when it differs from the design default', () => {
    const optIn = SPECS.sporty;
    expect(optIn.cta).toBe(false);
    expect(setFooterField(null, 'showCta', true, optIn)).toEqual({ showCta: true });
    expect(setFooterField({ showCta: true }, 'showCta', false, optIn)).toBeNull();
    expect(withColumns({ showCta: false }, footerColumns(null, optIn), optIn)).toBeNull();
    // Redline (the default spec) keeps its old rule: only false is stored.
    expect(setFooterField(null, 'showCta', false)).toEqual({ showCta: false });
    expect(setFooterField({ showCta: false }, 'showCta', true)).toBeNull();
    expect(setFooterField(null, 'showCta', false, SPECS.redline)).toEqual({ showCta: false });
  });

  it('never merges hours into the contact column unless the design does', () => {
    const cols = footerColumns({ columns: [{ type: 'contact' }, { type: 'hours' }] }, SPECS.sporty);
    expect(hoursMerged(cols, SPECS.sporty)).toBe(false);
    expect(hoursMerged(footerColumns(null), SPECS.redline)).toBe(true);
  });

  it("the panel lists the design's columns, titles, notes and button default", () => {
    const out = html({ copy: {}, spec: SPECS.sudsy });
    expect(out).toContain('aria-label="Show Services list"');
    expect(out.match(/role="switch"/g)).toHaveLength(SPECS.sudsy.columns.length + 1);
    expect(out).toContain('placeholder="Title (default: Say Hi!)"');
    expect(out).toContain(SPECS.sudsy.notes.services);
    expect(out).not.toContain('Button text');
    expect(out).toContain('placeholder="Leave empty for the design&#x27;s own bottom line"');
    const on = html({ copy: { footer: { showCta: true } }, spec: SPECS.sporty });
    expect(on).toContain('placeholder="Book Now"');
    expect(on).toContain('Shown as its own column.');
    expect(on).not.toContain('Shown under Get in touch');
  });
});

describe('footer specs of the opt-in themes', () => {
  const SPEC = {
    columns: [{ type: 'brand', show: true }, { type: 'links', show: true }, { type: 'services', show: true }, { type: 'contact', show: true }, { type: 'hours', show: false }],
    titles: { links: 'Explore', services: 'Services', contact: 'Say Hi!', hours: 'Hours' },
    mergeHours: false,
    cta: false,
    ctaLabel: 'Book Now!',
    contactFields: ['phone', 'email', 'address', 'city', 'state'],
    socialWhenBrandOff: true,
  };

  it('counts only the contact facts the design lists, and social links while the logo column is off', () => {
    const social = { instagram: '@shop', hours: 'Mon-Fri 9-5' };
    expect(emptyColumns(social, SPEC).has('contact')).toBe(true);
    const off = footerColumns(setColumn(null, 'brand', { show: false }, SPEC), SPEC);
    expect(emptyColumns(social, SPEC, { cols: off }).has('contact')).toBe(false);
    expect(emptyColumns({ phone: '1' }, SPEC).has('contact')).toBe(false);
    // Without a spec (Redline), social links count as before.
    expect(emptyColumns(social).has('contact')).toBe(false);
  });

  it('flags an empty services list, or one whose section is switched off', () => {
    expect(emptyColumns({ phone: '1' }, SPEC, { copy: {} }).has('services')).toBe(true);
    const biz = { phone: '1', services: [{ name: 'Wash', price: '$20' }] };
    expect(emptyColumns(biz, SPEC, { copy: {} }).has('services')).toBe(false);
    expect(emptyColumns(biz, SPEC, { copy: { hiddenSections: ['services'] } }).has('services')).toBe(true);
    // Only where the design has a services column.
    expect(emptyColumns({ phone: '1' }).has('services')).toBe(false);
  });

  it("names the contact column as the page does, and drops its warning while the button keeps it", () => {
    const out = html({ copy: {}, spec: SPEC, businessInfo: { businessName: 'X', instagram: '@shop' } });
    expect(out).toContain('aria-label="Show Say Hi!"');
    expect(out).toContain('Nothing to list yet: add a phone or email in Edit &gt; Business Info.');
    expect(out).toContain('Nothing to list yet: add services in Edit &gt; Services');
    const withButton = html({ copy: { footer: setFooterField(null, 'showCta', true, SPEC) }, spec: SPEC, businessInfo: { businessName: 'X' } });
    expect(withButton).not.toContain('add a phone or email');
    expect(withButton).toContain('Sits in the Say Hi! column');
  });
});
