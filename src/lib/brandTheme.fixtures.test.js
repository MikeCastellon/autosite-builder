import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  hexToRgb, rgbToHex, mix, alpha, luminance, contrastRatio, isDark, readableOn, ensureContrast, deriveTheme,
} from '../components/preview/templates/kit/theme.js';
import { FONT_CATALOG } from './fontCatalog.js';
import { FONT_PAIRINGS, STYLE_MOODS, isBodyFamily, rankPairings } from '../data/fontPairings.js';
import { HEADING_FONTS, BODY_FONTS } from '../data/fontOptions.js';
import { SITE_BUSINESS_TYPES } from './customSiteDesign.js';

// The launch-brand-system skill (skills/api/launch-brand-system) runs in
// Anthropic's code-execution container: Python, no Node, no network. So it
// carries a Python port of kit/theme.js (scripts/theme.py) and JSON copies of
// the font catalog and pairings (data/fonts.json). A brand the skill passes
// must pass on the site, so this test computes those files from the JS
// sources and fails when the committed copies drift.
//
// After changing kit/theme.js, fontCatalog.js, fontPairings.js or
// fontOptions.js:
//   UPDATE_SKILL_FIXTURES=1 npx vitest run src/lib/brandTheme.fixtures.test.js
//   python3 skills/api/launch-brand-system/tests/test_theme.py
// (in the mirror, then copy the regenerated files back to the repo).

const ROOT = path.resolve(__dirname, '../..');
const SKILL = path.join(ROOT, 'skills/api/launch-brand-system');
const UPDATE = process.env.UPDATE_SKILL_FIXTURES === '1';

// One case per line: readable diffs, and small enough to ship in the skill.
function stableJson(obj) {
  const lines = ['{'];
  const keys = Object.keys(obj);
  keys.forEach((key, i) => {
    const v = obj[key];
    const comma = i < keys.length - 1 ? ',' : '';
    if (Array.isArray(v)) {
      lines.push(`  ${JSON.stringify(key)}: [`);
      v.forEach((item, j) => lines.push(`    ${JSON.stringify(item)}${j < v.length - 1 ? ',' : ''}`));
      lines.push(`  ]${comma}`);
    } else if (v && typeof v === 'object') {
      const inner = Object.keys(v);
      lines.push(`  ${JSON.stringify(key)}: {`);
      inner.forEach((k, j) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v[k])}${j < inner.length - 1 ? ',' : ''}`));
      lines.push(`  }${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(v)}${comma}`);
    }
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

// Writes the file under UPDATE (or when it is missing); otherwise says
// whether the committed copy matches. Line endings are ignored: the repo's
// working copies may be CRLF.
function syncFile(file, content) {
  if (UPDATE || !fs.existsSync(file)) {
    fs.writeFileSync(file, content);
    return true;
  }
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') === content;
}

const stale = (rel) => `${rel} is stale: run UPDATE_SKILL_FIXTURES=1 npx vitest run src/lib/brandTheme.fixtures.test.js, then python3 skills/api/launch-brand-system/tests/test_theme.py`;

// Seeded PRNG (mulberry32): the same random cases on every run.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomHex(r) {
  return rgbToHex(Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256));
}

// Page backgrounds are mostly very dark or very light; mid-tones exercise
// the repair paths.
function randomBg(r) {
  const x = r();
  if (x < 0.35) return mix('#000000', randomHex(r), r() * 0.15);
  if (x < 0.7) return mix('#ffffff', randomHex(r), r() * 0.12);
  return randomHex(r);
}

// Real palettes: the theme-ready templates' defaults (designSuggest.js
// SUGGEST_TEMPLATES) and a few awkward owner picks.
const NAMED_PALETTES = [
  { bg: '#111111', accent: '#e53e3e', text: '#ffffff', secondary: '#1f1f1f', muted: '#aaaaaa' },
  { bg: '#1c1c1c', accent: '#eab308', text: '#ffffff', secondary: '#2c2c2c', muted: '#999999' },
  { bg: '#0a0a0a', accent: '#94a3b8', text: '#ffffff', secondary: '#141414', muted: '#888888' },
  { bg: '#030303', accent: '#ca8a04', text: '#ffffff', secondary: '#0f0f0f', muted: '#777777' },
  { bg: '#050507', accent: '#7C3AED', text: '#ffffff', secondary: '#0d0d12', muted: '#888888' },
  { bg: '#fffbeb', accent: '#f59e0b', text: '#1c1917', secondary: '#fef3c7', muted: '#78716c' },
  { bg: '#F0F1F3', accent: '#A8813A', text: '#1C1E24', secondary: '#FFFFFF', muted: '#7A7D88' },
  { bg: '#111111', accent: '#C0392B', text: '#ffffff', secondary: '#1e1e1e', muted: '#aaaaaa' },
  { bg: '#f0f9ff', accent: '#06b6d4', text: '#0c4a6e', secondary: '#e0f7fa', muted: '#64748b' },
  { bg: '#ffffff', accent: '#808080', text: '#999999', secondary: '#333333', muted: '#cccccc' },
  { bg: '#777777', accent: '#777777', text: '#777777', secondary: '#777777', muted: '#777777' },
  { bg: '#fff', accent: 'rgb(204, 0, 0)', text: '#222', secondary: '#f5f5f5f5', muted: 'nope' },
  { bg: '  #0B1220 ', accent: '#00E5FF', text: '', secondary: null, muted: 42 },
  { text: '#ffffff' },
  { text: '#000000' },
  { accent: '#ff6600' },
  {},
  null,
  'not an object',
];

function themeFixtures() {
  const r = rng(20261005);

  const hexInputs = [
    '#abc', 'abc', '#ABCD', '#aabbcc', 'AABBCC', '#aabbccdd', '#AbCdEf12', ' #fff ', '\t#123456\n',
    'rgb(1,2,3)', 'rgba(10, 20, 30, 0.5)', 'RGB(255 128 0)', 'rgb(300, 2.5, 3.5)', 'rgb(1.2.3, 4, 5)', 'rgb(., 4, 5)',
    'rgb(-1, 2, 3)', 'rgb(1,2)', '#12', '#12345', '#1234567', 'red', '', '#ggg', 'rgb( 7 ,8 ,9 )', 'rgba(0,0,0)extra',
    null, 42, true,
  ];
  const colors = [];
  for (let i = 0; i < 40; i++) colors.push(randomHex(r));
  colors.push('#ffffff', '#000000', '#111111', '#767676', '#777777', '#808080', '#2563eb', '#e53e3e', 'garbage');

  const rgbTriples = [[0, 0, 0], [255, 255, 255], [12.5, 13.5, 14.49], [-4, 300, 128], [0.5, 1.5, 2.5], [254.5, 255.4, 3.4999]];
  for (let i = 0; i < 20; i++) rgbTriples.push([r() * 300 - 20, r() * 300 - 20, r() * 300 - 20]);

  const mixes = [['#000000', '#ffffff', 0.5], ['#ff0000', '#0000ff', 0.25], ['#123456', '#abcdef', -1], ['#123456', '#abcdef', 2],
    ['#123456', 'nope', 0.5], ['nope', '#abcdef', 0.5], ['nope', 'nope', 0.5], ['#fff', '#000', 0.333], ['#123456', '#654321', null]];
  for (let i = 0; i < 40; i++) mixes.push([randomHex(r), randomHex(r), Math.round(r() * 1000) / 1000]);

  const alphas = [['#ff0000', 0.2], ['#ff0000', 1], ['#ff0000', 0], ['#ff0000', 1.5], ['#ff0000', -1], ['#ff0000', 0.0625],
    ['#ff0000', 0.1235], ['nope', 0.5], ['#00ff00', null], ['#0000ff', 0.16], ['#0000ff', 0.333333]];

  const pairs = [];
  for (let i = 0; i < 40; i++) pairs.push([randomHex(r), randomHex(r)]);
  pairs.push(['#ffffff', '#000000'], ['#777777', '#ffffff'], ['nope', '#ffffff']);

  const ensure = [['#777777', '#ffffff', 4.5], ['#ffffff', '#ffffff', 4.5], ['#000000', '#777777', 21], ['nope', '#ffffff', 4.5],
    ['#123456', 'nope', 4.5], ['#ABC', '#000', 3], ['#808080', '#808080', 4.5], ['#e53e3e', '#111111', 7]];
  for (let i = 0; i < 90; i++) ensure.push([randomHex(r), i % 3 === 0 ? randomHex(r) : randomBg(r), [3, 4.5, 7][i % 3]]);

  const palettes = [...NAMED_PALETTES];
  for (let i = 0; i < 140; i++) {
    const p = {};
    const bg = randomBg(r);
    const dark = isDark(bg);
    if (r() > 0.05) p.bg = bg;
    if (r() > 0.1) p.secondary = r() < 0.7 ? mix(bg, dark ? '#ffffff' : '#000000', r() * 0.25) : randomHex(r);
    if (r() > 0.1) p.text = r() < 0.6 ? mix(dark ? '#ffffff' : '#000000', randomHex(r), r() * 0.5) : randomHex(r);
    if (r() > 0.1) p.muted = randomHex(r);
    if (r() > 0.05) p.accent = randomHex(r);
    palettes.push(p);
  }

  return {
    generatedBy: 'src/lib/brandTheme.fixtures.test.js from src/components/preview/templates/kit/theme.js',
    hexToRgb: hexInputs.map((input) => [input, hexToRgb(input)]),
    rgbToHex: rgbTriples.map(([a, b, c]) => [[a, b, c], rgbToHex(a, b, c), rgbToHex({ r: a, g: b, b: c })]),
    mix: mixes.map(([a, b, t]) => [a, b, t, mix(a, b, t)]),
    alpha: alphas.map(([c, a]) => [c, a, alpha(c, a)]),
    luminance: colors.map((c) => [c, luminance(c), isDark(c), readableOn(c)]),
    contrastRatio: pairs.map(([a, b]) => [a, b, contrastRatio(a, b)]),
    ensureContrast: ensure.map(([fg, bg, min]) => [fg, bg, min, ensureContrast(fg, bg, min)]),
    deriveTheme: palettes.map((p) => {
      const t = deriveTheme(p);
      return [p, t, {
        'text/bg': contrastRatio(t.text, t.bg),
        'muted/bg': contrastRatio(t.textMuted, t.bg),
        'onAccent/accent': contrastRatio(t.onAccent, t.accent),
        'text/secondary': contrastRatio(t.text, t.surface),
      }];
    }),
  };
}

// The editor's one-line descriptions ("Montserrat — Clean Geometric").
function descriptors() {
  const out = {};
  for (const o of [...HEADING_FONTS, ...BODY_FONTS]) {
    const family = /^'([^']+)'/.exec(o.family)?.[1];
    const words = o.label.split(' — ')[1];
    if (family && words && !out[family]) out[family] = words;
  }
  return out;
}

function fontsData() {
  const desc = descriptors();
  const families = {};
  for (const family of Object.keys(FONT_CATALOG).sort((a, b) => a.localeCompare(b))) {
    const f = FONT_CATALOG[family];
    const asHeading = FONT_PAIRINGS.filter((p) => p.heading === family);
    const asBody = FONT_PAIRINGS.filter((p) => p.body === family);
    const mood = [];
    for (const word of [...(desc[family] || '').toLowerCase().split(/\s+/), ...[...asHeading, ...asBody].flatMap((p) => p.mood)]) {
      if (word && !mood.includes(word)) mood.push(word);
    }
    families[family] = {
      category: f.category,
      weights: f.weights,
      italics: f.italics,
      body: isBodyFamily(family),
      inEditor: !!desc[family],
      descriptor: desc[family] || '',
      headingIn: asHeading.map((p) => p.id),
      bodyIn: asBody.map((p) => p.id),
      mood,
    };
  }
  return {
    generatedBy: 'src/lib/brandTheme.fixtures.test.js from src/lib/fontCatalog.js, src/data/fontPairings.js and src/data/fontOptions.js',
    families,
    pairings: FONT_PAIRINGS.map((p) => ({ id: p.id, name: p.name, heading: p.heading, body: p.body, mood: [...p.mood], types: [...p.types], note: p.note })),
    styleMoods: Object.fromEntries(Object.entries(STYLE_MOODS).map(([k, v]) => [k, [...v]])),
    businessTypes: SITE_BUSINESS_TYPES.map((t) => ({ value: t.value, label: t.label })),
  };
}

function rankFixtures() {
  const styleSets = [[], ['Bold & sporty'], ['Clean & minimal'], ['Luxury & high-end', 'Dark & moody'], ['Bright & friendly'],
    ['Rugged & industrial', 'Classic & trusted'], ['Modern & techy'], ['Dark & moody', 'Bold & sporty', 'Modern & techy'],
    'Bold & sporty, Clean & minimal', ['retro diner vibe, playful'], ['constructor'], ['  ', 'Classic & trusted', 'Classic & trusted']];
  const types = [undefined, 'detailing_shop', 'mobile_detailing', 'tint_shop', 'wheel_shop', 'mechanic_shop', 'car_wash'];
  const moods = [undefined, 'bold, energetic, performance-driven, aggressive', 'fun, playful, cheerful, family-friendly, bright'];
  const cases = [];
  styleSets.forEach((styles, i) => {
    const businessType = types[i % types.length];
    const mood = moods[i % moods.length];
    const ranked = rankPairings({ styles, businessType, mood });
    cases.push([{ styles, businessType: businessType ?? null, mood: mood ?? null }, ranked.map((p) => [p.id, p.fits, p.score, p.reasons])]);
  });
  return { generatedBy: 'src/lib/brandTheme.fixtures.test.js from src/data/fontPairings.js rankPairings()', rankPairings: cases };
}

describe('launch-brand-system skill data', () => {
  it('tests/theme_fixtures.json matches kit/theme.js', () => {
    const rel = 'skills/api/launch-brand-system/tests/theme_fixtures.json';
    expect(syncFile(path.join(ROOT, rel), stableJson(themeFixtures())), stale(rel)).toBe(true);
  });

  it('data/fonts.json matches the font catalog and pairings', () => {
    const rel = 'skills/api/launch-brand-system/data/fonts.json';
    expect(syncFile(path.join(ROOT, rel), stableJson(fontsData())), stale(rel)).toBe(true);
  });

  it('tests/fonts_fixtures.json matches rankPairings()', () => {
    const rel = 'skills/api/launch-brand-system/tests/fonts_fixtures.json';
    expect(syncFile(path.join(ROOT, rel), stableJson(rankFixtures())), stale(rel)).toBe(true);
  });

  it('every look-alike font is in the catalog', () => {
    const data = JSON.parse(fs.readFileSync(path.join(SKILL, 'data/font_lookalikes.json'), 'utf8'));
    const targets = Object.values(data.lookalikes).flat();
    expect(targets.length).toBeGreaterThan(20);
    for (const family of targets) expect(FONT_CATALOG[family], family).toBeTruthy();
  });

  // The Skills API rejects a bad frontmatter only at upload time.
  it('SKILL.md frontmatter fits the Skills API limits', () => {
    const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(md);
    expect(fm).not.toBeNull();
    const name = /^name:\s*(.+)$/m.exec(fm[1])?.[1].trim();
    const description = /^description:\s*(.+)$/m.exec(fm[1])?.[1].trim();
    expect(name).toBe('launch-brand-system');
    expect(name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(name).not.toMatch(/claude|anthropic/);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).not.toMatch(/<[a-z/]/i);
    expect(md.split('\n').length).toBeLessThan(250);
  });

  // Uploads must stay well under the Skills API's 30 MB, and nothing in the
  // folder may be a stray build artifact (bytecode, AppleDouble files).
  it('the skill folder is small and clean', () => {
    let total = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        expect(entry.name, full).not.toMatch(/^\._|^__pycache__$|\.pyc$|^\.DS_Store$/);
        if (entry.isDirectory()) walk(full);
        else {
          const size = fs.statSync(full).size;
          expect(size, full).toBeLessThan(400 * 1024);
          total += size;
        }
      }
    };
    walk(SKILL);
    expect(total).toBeLessThan(2 * 1024 * 1024);
  });
});
