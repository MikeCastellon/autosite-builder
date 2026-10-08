// Raw Garage gains features as opt-ins (the Before & After band first), so a
// site that saved none of the keys a later feature added must render
// byte-identical HTML, published and in the editor, like the themes with
// live sites (CLAUDE.md, "Themes with live sites"). MechanicGarage.golden.json
// freezes the page as it rendered before the Before & After section
// (2026-10-08): the props of the four shared fixtures (sparse, full,
// custom, features) as the template receives them (normalized business
// info, resolved template meta, photos as short stand-in URLs, JSON round
// tripped like a saved row), and a SHA-256 of each render. The props are
// stored rather than rebuilt from __fixtures__, so a fixture or demo-data
// edit can't move the target: only this template and the kit it renders
// with can.
//
// A change that is meant to reach every Raw Garage site (checked by hand
// first) refreshes the hashes, keeping the stored props:
//   GARAGE_GOLDEN=update npx vitest run src/components/preview/templates/mechanic/MechanicGarage.golden.test.jsx
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Garage from './MechanicGarage.jsx';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { FIXTURES } from '../__fixtures__/businesses.js';

const GOLDEN = fileURLToPath(new URL('./MechanicGarage.golden.json', import.meta.url));
const UPDATE = process.env.GARAGE_GOLDEN === 'update';
const NAMES = ['sparse', 'full', 'custom', 'features'];
const MODES = ['publish', 'editor'];

// Keys of features added after the golden was taken: a site without them
// is what the golden describes, so a rebuild from the fixtures drops them.
const LATER_COPY_KEYS = ['beforeAfter'];
const LATER_IMAGE_KEY = /^ba(?:Before|After)\d+$/;

// Props as the template receives them, from a fixture (only used when the
// golden file is missing). SVG data URIs become short stand-in URLs, so the
// file stays small; the page only prints them.
function propsFrom(fx) {
  const urls = new Map();
  const short = (v) => {
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      if (!urls.has(v)) urls.set(v, `https://img.test/photo-${urls.size + 1}.svg`);
      return urls.get(v);
    }
    if (Array.isArray(v)) return v.map(short);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, short(x)]));
    return v;
  };
  const copy = Object.fromEntries(Object.entries(fx.generatedCopy).filter(([k]) => !LATER_COPY_KEYS.includes(k)));
  const images = Object.fromEntries(Object.entries(fx.images || {}).filter(([k]) => !LATER_IMAGE_KEY.test(k)));
  return JSON.parse(JSON.stringify(short({
    businessInfo: normalizeBusinessInfo(fx.businessInfo),
    generatedCopy: copy,
    templateMeta: buildTemplateMeta('mechanic_garage', fx.customColors, fx.customFonts),
    images,
  })));
}

// The footer prints the current year: the only part of the page that may
// differ from one run to the next.
const stable = (html) => html.replace(/(<span data-acg-year="">)\d{4}(<\/span>)/g, '$1YEAR$2');
const sha = (html) => createHash('sha256').update(stable(html), 'utf8').digest('hex');

function render(props, mode) {
  const el = createElement(Garage, props);
  return renderToStaticMarkup(mode === 'editor' ? createElement(EditorModeProvider, { value: true }, el) : el);
}

function load() {
  if (existsSync(GOLDEN)) return JSON.parse(readFileSync(GOLDEN, 'utf8'));
  return { fixtures: Object.fromEntries(NAMES.map((n) => [n, propsFrom(FIXTURES[n])])), hashes: {} };
}

describe('mechanic_garage golden: a site without the newer keys renders exactly as before', () => {
  const golden = load();

  if (UPDATE) {
    it('writes the golden hashes', () => {
      const hashes = {};
      for (const n of NAMES) for (const m of MODES) hashes[`${n}/${m}`] = sha(render(golden.fixtures[n], m));
      writeFileSync(GOLDEN, `${JSON.stringify({ ...golden, hashes }, null, 1)}\n`);
      expect(Object.keys(hashes)).toHaveLength(NAMES.length * MODES.length);
    });
    return;
  }

  it('has a stored render for every fixture and mode', () => {
    expect(Object.keys(golden.fixtures).sort()).toEqual([...NAMES].sort());
    expect(Object.keys(golden.hashes).sort()).toEqual(NAMES.flatMap((n) => MODES.map((m) => `${n}/${m}`)).sort());
  });

  it.each(NAMES.flatMap((n) => MODES.map((m) => [n, m])))('%s / %s', (name, mode) => {
    expect(sha(render(golden.fixtures[name], mode))).toBe(golden.hashes[`${name}/${mode}`]);
  });

  it('the stored props hold none of the newer keys', () => {
    for (const n of NAMES) {
      const { generatedCopy, images } = golden.fixtures[n];
      expect(LATER_COPY_KEYS.filter((k) => k in generatedCopy)).toEqual([]);
      expect(Object.keys(images).filter((k) => LATER_IMAGE_KEY.test(k))).toEqual([]);
    }
  });
});
