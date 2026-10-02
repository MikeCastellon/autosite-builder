import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FONT_CATALOG, LEGACY_EXPORT_FAMILIES, familyFromStack, familiesFromStack,
  catalogFamily, buildFontHref,
} from './fontCatalog.js';
import { HEADING_FONTS, BODY_FONTS } from '../data/fontOptions.js';
import { TEMPLATES } from '../data/templates.js';

// The fixed list every published page loaded before fontCatalog existed.
const OLD_EXPORT_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;800&family=Outfit:wght@400;500;600;700;800;900&family=Syne:wght@400;500;600;700;800&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&family=Bebas+Neue&family=Righteous&family=Boogaloo&family=Nunito:wght@400;600;700;800&display=swap';

// family=Name:wght@a;b or ital,wght@0,a;1,b -> { Name: { upright: [...], italic: [...] } }
function parseHref(href) {
  const out = {};
  for (const param of new URL(href).searchParams.getAll('family')) {
    const [name, spec = ''] = param.split(':');
    const entry = { upright: [], italic: [] };
    const [axes, values = ''] = spec.split('@');
    if (axes === 'wght') entry.upright = values.split(';').map(Number);
    if (axes === 'ital,wght') {
      for (const tuple of values.split(';')) {
        const [ital, w] = tuple.split(',').map(Number);
        (ital ? entry.italic : entry.upright).push(w);
      }
    }
    out[name] = entry;
  }
  return out;
}

describe('FONT_CATALOG', () => {
  it('covers every font an owner can pick', () => {
    for (const { family } of [...HEADING_FONTS, ...BODY_FONTS]) {
      expect(catalogFamily(familyFromStack(family)), family).not.toBeNull();
    }
  });

  it('covers every registry font and the legacy export list', () => {
    for (const t of Object.values(TEMPLATES)) {
      expect(catalogFamily(familyFromStack(t.font)), t.id).not.toBeNull();
      expect(catalogFamily(familyFromStack(t.bodyFont)), t.id).not.toBeNull();
    }
    expect(LEGACY_EXPORT_FAMILIES).toHaveLength(13);
    for (const f of LEGACY_EXPORT_FAMILIES) expect(FONT_CATALOG[f], f).toBeDefined();
  });

  it('covers every family the editor preloads in index.html', () => {
    const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
    const href = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/)[0].replace(/&amp;/g, '&');
    for (const name of Object.keys(parseHref(href))) {
      expect(FONT_CATALOG[name], name).toBeDefined();
    }
  });

  it('has sorted, valid weights', () => {
    for (const [name, { weights, italics }] of Object.entries(FONT_CATALOG)) {
      for (const list of [weights, italics]) {
        expect([...list].sort((a, b) => a - b), name).toEqual(list);
        for (const w of list) expect(w % 100 === 0 && w >= 100 && w <= 900, `${name} ${w}`).toBe(true);
      }
    }
  });
});

describe('familyFromStack / familiesFromStack', () => {
  it('extracts the first named family', () => {
    expect(familyFromStack("'Inter', sans-serif")).toBe('Inter');
    expect(familyFromStack('"Playfair Display", Georgia, serif')).toBe('Playfair Display');
    expect(familyFromStack('Source Sans 3')).toBe('Source Sans 3');
    expect(familyFromStack('sans-serif')).toBeNull();
    expect(familyFromStack(undefined)).toBeNull();
    expect(familyFromStack(12)).toBeNull();
  });

  it('lists every named family, dropping generics', () => {
    expect(familiesFromStack("'Syne Mono', 'Syne', monospace")).toEqual(['Syne Mono', 'Syne']);
    expect(familiesFromStack("system-ui, -apple-system, 'Segoe UI', sans-serif")).toEqual(['Segoe UI']);
  });
});

describe('buildFontHref', () => {
  it('builds one URL with the catalog weights', () => {
    expect(buildFontHref(["'Inter', sans-serif"])).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    );
  });

  it('dedupes, sorts, matches case-insensitively and ignores unknown families', () => {
    const href = buildFontHref(["'outfit', sans-serif", 'Inter', "'Inter', sans-serif", "'Comic Neue', cursive", 'serif']);
    expect(href).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
    );
  });

  it('requests single-weight faces bare and italics as sorted tuples', () => {
    const href = buildFontHref(['Bebas Neue', "'DM Serif Display', serif", "'Playfair Display', Georgia, serif"]);
    expect(href).toContain('family=Bebas+Neue&');
    expect(href).toContain('family=DM+Serif+Display:ital@0;1&');
    expect(href).toContain('family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&');
    expect(href.endsWith('&display=swap')).toBe(true);
  });

  it('tolerates nested arrays and junk; null when nothing is loadable', () => {
    expect(buildFontHref([undefined, null, 3, ["'Lato', sans-serif", ['Roboto']]])).toContain('family=Lato:');
    expect(buildFontHref([])).toBeNull();
    expect(buildFontHref([undefined, 'sans-serif', "'Nope Sans'"])).toBeNull();
    expect(buildFontHref(undefined)).toBeNull();
    expect(buildFontHref("'Inter', sans-serif")).toContain('family=Inter:');
  });

  it('loads at least every weight the old fixed export list did', () => {
    const old = parseHref(OLD_EXPORT_HREF);
    const next = parseHref(buildFontHref(LEGACY_EXPORT_FAMILIES));
    expect(Object.keys(next).sort()).toEqual(Object.keys(old).sort());
    for (const [name, { upright }] of Object.entries(old)) {
      for (const w of upright) expect(next[name].upright.length === 0 || next[name].upright.includes(w), `${name} ${w}`).toBe(true);
    }
  });
});
