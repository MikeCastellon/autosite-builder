import { describe, it, expect } from 'vitest';
import {
  FONT_PAIRINGS, FONT_CATEGORIES, STYLE_MOODS,
  allFontFamilies, isBodyFamily, pairingById, pairingFor, rankPairings,
} from './fontPairings.js';
import { FONT_CATALOG, buildFontHref } from '../lib/fontCatalog.js';
import { familyOf, fontStack, leverPatch } from '../lib/designLevers.js';
import { FORM_FIELDS } from '../lib/customSiteForm.js';
import { SITE_BUSINESS_TYPES } from '../lib/customSiteDesign.js';
import { TEMPLATES } from './templates.js';

const INTAKE_STYLES = FORM_FIELDS.find((f) => f.id === 'styles').options.map((o) => o.value);
const TYPE_IDS = SITE_BUSINESS_TYPES.map((t) => t.value);
const ids = (list) => list.map((p) => p.id);

describe('FONT_PAIRINGS', () => {
  it('has 12 to 16 complete pairings with unique ids, names and font combinations', () => {
    expect(FONT_PAIRINGS.length).toBeGreaterThanOrEqual(12);
    expect(FONT_PAIRINGS.length).toBeLessThanOrEqual(16);
    expect(new Set(ids(FONT_PAIRINGS)).size).toBe(FONT_PAIRINGS.length);
    expect(new Set(FONT_PAIRINGS.map((p) => p.name)).size).toBe(FONT_PAIRINGS.length);
    expect(new Set(FONT_PAIRINGS.map((p) => `${p.heading}|${p.body}`)).size).toBe(FONT_PAIRINGS.length);
    for (const p of FONT_PAIRINGS) {
      expect(p.id).toMatch(/^[a-z][a-z_]*$/);
      for (const key of ['name', 'heading', 'body', 'note']) expect(typeof p[key] === 'string' && p[key].trim()).toBeTruthy();
      expect(p.note).not.toMatch(/\n/);
      expect(p.mood.length).toBeGreaterThan(0);
    }
  });

  it('uses only FONT_CATALOG families, with a body face that can carry paragraphs', () => {
    for (const p of FONT_PAIRINGS) {
      expect(FONT_CATALOG[p.heading], `${p.id} heading ${p.heading}`).toBeTruthy();
      expect(FONT_CATALOG[p.body], `${p.id} body ${p.body}`).toBeTruthy();
      expect(p.heading).not.toBe(p.body);
      expect(isBodyFamily(p.body), `${p.id} body ${p.body}`).toBe(true);
    }
  });

  it('turns into loadable CSS stacks through the levers', () => {
    for (const p of FONT_PAIRINGS) {
      const heading = fontStack(p.heading);
      const body = fontStack(p.body);
      expect(heading).not.toBe('');
      expect(body).not.toBe('');
      expect(familyOf(heading)).toBe(p.heading);
      expect(familyOf(body)).toBe(p.body);
      // sanitizeLevers keeps both, so the pairing reaches the site as-is.
      expect(leverPatch({ fonts: { heading: p.heading, body: p.body } }, 'carwash_bubble').fonts)
        .toEqual({ font: heading, bodyFont: body });
      const href = buildFontHref([heading, body]);
      expect(href).toContain(`family=${p.heading.replace(/ /g, '+')}`);
      expect(href).toContain(`family=${p.body.replace(/ /g, '+')}`);
    }
  });

  it('is frozen, so callers cannot edit the shared list', () => {
    expect(Object.isFrozen(FONT_PAIRINGS)).toBe(true);
    expect(Object.isFrozen(FONT_PAIRINGS[0])).toBe(true);
    expect(Object.isFrozen(FONT_PAIRINGS[0].mood)).toBe(true);
  });
});

describe('moods and business types', () => {
  it('knows every style chip on the intake form', () => {
    expect(INTAKE_STYLES.length).toBeGreaterThan(0);
    for (const style of INTAKE_STYLES) expect(STYLE_MOODS[style], style).toBeTruthy();
    expect(Object.keys(STYLE_MOODS).sort()).toEqual([...INTAKE_STYLES].sort());
  });

  it('offers at least two pairings for every style, and every pairing fits some style', () => {
    for (const style of INTAKE_STYLES) {
      const fitting = rankPairings({ styles: [style] }).filter((r) => r.fits > 0);
      expect(fitting.length, style).toBeGreaterThanOrEqual(2);
    }
    for (const p of FONT_PAIRINGS) {
      const fitsAny = INTAKE_STYLES.some((style) => p.mood.some((m) => STYLE_MOODS[style].includes(m)));
      expect(fitsAny, p.id).toBe(true);
    }
  });

  it('names only real business types, and covers each with at least three pairings', () => {
    for (const p of FONT_PAIRINGS) for (const t of p.types) expect(TYPE_IDS).toContain(t);
    for (const t of TYPE_IDS) expect(FONT_PAIRINGS.filter((p) => p.types.includes(t)).length, t).toBeGreaterThanOrEqual(3);
  });

  it('shares vocabulary with every visible template\'s mood', () => {
    for (const t of Object.values(TEMPLATES).filter((x) => !x.hidden && x.mood)) {
      expect(rankPairings({ mood: t.mood })[0].score, t.id).toBeGreaterThan(0);
    }
  });
});

describe('pairingById / pairingFor', () => {
  it('finds pairings by id and by their exact fonts', () => {
    const p = FONT_PAIRINGS[3];
    expect(pairingById(p.id)).toBe(p);
    expect(pairingById('nope')).toBeNull();
    expect(pairingById(undefined)).toBeNull();
    expect(pairingFor({ heading: p.heading, body: p.body })).toBe(p);
    expect(pairingFor({ heading: p.body, body: p.heading })).toBeNull();
    expect(pairingFor({ heading: p.heading })).toBeNull();
    expect(pairingFor(null)).toBeNull();
  });
});

describe('rankPairings', () => {
  it('keeps the curated order when there is nothing to rank by', () => {
    for (const ranked of [rankPairings(), rankPairings({}), rankPairings({ styles: [], businessType: 'other' })]) {
      expect(ids(ranked)).toEqual(ids(FONT_PAIRINGS));
      expect(ranked.every((r) => r.score === 0 && r.fits === 0 && r.reasons.length === 0)).toBe(true);
    }
  });

  it('is deterministic, and the order of the style picks does not matter', () => {
    const args = { styles: ['Dark & moody', 'Modern & techy', 'Luxury & high-end'], businessType: 'tint_shop', mood: 'premium, sleek, dark' };
    const a = rankPairings(args);
    expect(rankPairings(args)).toEqual(a);
    const b = rankPairings({ ...args, styles: [...args.styles].reverse() });
    expect(ids(b)).toEqual(ids(a));
    expect(b.map((r) => r.score)).toEqual(a.map((r) => r.score));
    // Repeated picks count once.
    expect(rankPairings({ ...args, styles: [...args.styles, ...args.styles] }).map((r) => r.score)).toEqual(a.map((r) => r.score));
  });

  it('returns every pairing as a copy with its score', () => {
    const ranked = rankPairings({ styles: ['Bold & sporty'] });
    expect(ranked).toHaveLength(FONT_PAIRINGS.length);
    expect(ranked[0]).not.toBe(pairingById(ranked[0].id));
    expect(ranked[0]).toMatchObject(pairingById(ranked[0].id));
  });

  it('puts the obvious pick first for clear briefs', () => {
    expect(rankPairings({ styles: ['Bright & friendly'], businessType: 'car_wash' })[0].id).toBe('suds');
    expect(ids(rankPairings({ styles: ['Rugged & industrial'], businessType: 'mechanic_shop' }).slice(0, 2)).sort())
      .toEqual(['heavy_duty', 'workshop']);
    expect(rankPairings({ styles: ['Clean & minimal'] })[0].id).toBe('minimal');
    expect(rankPairings({ styles: ['Bold & sporty'] })[0].id).toBe('street');
    const lux = rankPairings({ styles: ['Luxury & high-end'] })[0];
    expect(FONT_CATALOG[lux.heading].category).toBe('serif');
    expect(rankPairings({ mood: TEMPLATES.tint_obsidian.mood })[0].id).toBe('midnight');
  });

  it('ranks a pairing that fits more of the picked styles above any that fits fewer', () => {
    const ranked = rankPairings({ styles: ['Dark & moody', 'Modern & techy'], businessType: 'tint_shop' });
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].fits).toBeGreaterThanOrEqual(ranked[i].fits);
    expect(ranked[0].fits).toBe(2);
    expect(ranked[0].reasons).toEqual(expect.arrayContaining(['Dark & moody', 'Modern & techy', 'Suits this business type']));
  });

  it('reads free-text styles and a comma string as mood words', () => {
    expect(rankPairings({ styles: 'retro fun' })[0].id).toBe('drive_in');
    expect(ids(rankPairings({ styles: 'Bold & sporty, Clean & minimal' })))
      .toEqual(ids(rankPairings({ styles: ['Bold & sporty', 'Clean & minimal'] })));
  });

  it('treats untrusted style text as plain words, never as object keys', () => {
    // Free text or a model's answer may name Object.prototype members.
    for (const s of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      const ranked = rankPairings({ styles: [s, 42, null, { x: 1 }], businessType: s, mood: s });
      expect(ids(ranked), s).toEqual(ids(FONT_PAIRINGS));
      expect(ranked.every((r) => r.fits === 0 && r.score === 0), s).toBe(true);
    }
  });
});

describe('allFontFamilies', () => {
  it('lists every catalog family once, grouped by category, A-Z', () => {
    const groups = allFontFamilies();
    const all = groups.flatMap((g) => g.families.map((f) => f.family));
    expect(all.slice().sort()).toEqual(Object.keys(FONT_CATALOG).sort());
    expect(groups.map((g) => g.id)).toEqual(FONT_CATEGORIES.map((c) => c.id).filter((id) => groups.some((g) => g.id === id)));
    for (const g of groups) {
      const names = g.families.map((f) => f.family);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      for (const f of g.families) {
        expect(FONT_CATALOG[f.family].category).toBe(g.id);
        expect(f.stack).toBe(fontStack(f.family));
      }
    }
  });

  it('flags body faces and the families the owner\'s editor lists', () => {
    const flat = allFontFamilies().flatMap((g) => g.families);
    const get = (name) => flat.find((f) => f.family === name);
    expect(get('Inter')).toMatchObject({ body: true, inEditor: true });
    expect(get('Fraunces')).toMatchObject({ body: true, inEditor: false });
    expect(get('Bebas Neue')).toMatchObject({ body: false, inEditor: true });
    expect(get('JetBrains Mono').body).toBe(false);
  });

  it('keeps only body faces for the body slot, dropping empty groups', () => {
    const groups = allFontFamilies({ role: 'body' });
    expect(groups.map((g) => g.id)).toEqual(['sans', 'serif']);
    expect(groups.every((g) => g.families.every((f) => f.body && isBodyFamily(f.family)))).toBe(true);
  });
});
