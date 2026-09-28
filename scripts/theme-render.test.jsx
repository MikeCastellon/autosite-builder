// npm run theme:render
// Writes the full published page (exportHtmlString, free-tier bar on, no
// widget scripts) for every template x fixture into RENDER_OUT (default
// <os tmpdir>/theme-renders), plus an index.html linking them, so they can
// be opened or screenshotted at 390 / 768 / 1280px. __kit_sample__ (the
// kit reference template from __fixtures__) is included for comparison.
//   THEMES=mobile_chrome,detailing_sporty npm run theme:render
//   RENDER_OUT=/some/dir npm run theme:render
import { it, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// No network or env: the real client throws without VITE_SUPABASE_* and is
// only used for widget_configs lookups, which pass no ids here.
vi.mock('../src/lib/supabase.js', () => ({ supabase: {}, isImpersonationTab: false }));

const SAMPLE_ID = '__kit_sample__';
vi.mock('../src/data/templates.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TEMPLATE_COMPONENT_MAP: {
      ...actual.TEMPLATE_COMPONENT_MAP,
      __kit_sample__: () => import('../src/components/preview/templates/__fixtures__/KitSampleTemplate.jsx'),
    },
  };
});

const { exportHtmlString } = await import('../src/lib/exportHtml.js');
const { TEMPLATE_COMPONENT_MAP, TEMPLATES } = await import('../src/data/templates.js');
const { buildTemplateMeta } = await import('../src/lib/siteRender.js');
const { FIXTURES } = await import('../src/components/preview/templates/__fixtures__/businesses.js');
const { SAMPLE_META } = await import('../src/components/preview/templates/__fixtures__/KitSampleTemplate.jsx');

function metaFor(id, fx) {
  if (id !== SAMPLE_ID) return buildTemplateMeta(id, fx.customColors, fx.customFonts);
  return {
    ...SAMPLE_META,
    colors: { ...SAMPLE_META.colors, ...fx.customColors },
    font: fx.customFonts.font ?? SAMPLE_META.font,
    bodyFont: fx.customFonts.bodyFont ?? SAMPLE_META.bodyFont,
  };
}

const outDir = process.env.RENDER_OUT || join(tmpdir(), 'theme-renders');
const only = (process.env.THEMES || '').split(',').map((s) => s.trim()).filter(Boolean);
const ids = Object.keys(TEMPLATE_COMPONENT_MAP).filter((id) => only.length === 0 || only.includes(id));

it('renders every selected template x fixture to static HTML', async () => {
  const unknown = only.filter((id) => !TEMPLATE_COMPONENT_MAP[id]);
  expect(unknown, `unknown template ids in THEMES: ${unknown.join(', ')}`).toEqual([]);
  mkdirSync(outDir, { recursive: true });

  const rows = [];
  for (const id of ids) {
    const mod = await TEMPLATE_COMPONENT_MAP[id]();
    for (const [name, fx] of Object.entries(FIXTURES)) {
      const meta = metaFor(id, fx);
      const html = await exportHtmlString(id, fx.businessInfo, fx.generatedCopy, meta, fx.images, [], null, false);
      const file = `${id}--${name}.html`;
      writeFileSync(join(outDir, file), html);
      rows.push(`<li><a href="${file}">${id} / ${name}</a>${mod.themeReady === true ? ' (theme-ready)' : ''} - ${TEMPLATES[id]?.label || 'kit reference'}</li>`);
    }
  }

  writeFileSync(
    join(outDir, 'index.html'),
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Theme renders</title></head><body style="font-family:system-ui;padding:24px"><h1>Theme renders (${rows.length})</h1><ul>${rows.join('')}</ul></body></html>`,
  );
  console.log(`theme:render wrote ${rows.length} pages to ${outDir}`);
  expect(rows.length).toBe(ids.length * Object.keys(FIXTURES).length);
});
