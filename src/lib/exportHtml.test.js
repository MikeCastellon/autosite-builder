import { describe, it, expect, vi } from 'vitest';

// The real client throws without VITE_SUPABASE_* env; the export only needs
// it for widget_configs lookups, which these tests never trigger.
vi.mock('./supabase.js', () => ({ supabase: {}, isImpersonationTab: false }));

// Register the kit sample as a theme-ready template next to the real ones.
vi.mock('../data/templates.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TEMPLATE_COMPONENT_MAP: {
      ...actual.TEMPLATE_COMPONENT_MAP,
      __kit_sample__: () => import('../components/preview/templates/__fixtures__/KitSampleTemplate.jsx'),
    },
  };
});

const { exportHtmlString } = await import('./exportHtml.js');
const { buildTemplateMeta } = await import('./siteRender.js');
const { SITE_RUNTIME_JS, SITE_CQ_FALLBACK_JS, CQ_REWRITE_FN, SITE_BA_JS } = await import('./siteRuntime.js');
const { LEGACY_EXPORT_FAMILIES } = await import('./fontCatalog.js');
const { TEMPLATE_COMPONENT_MAP } = await import('../data/templates.js');
const { full, custom, FIXTURES } = await import('../components/preview/templates/__fixtures__/businesses.js');
const { SAMPLE_META } = await import('../components/preview/templates/__fixtures__/KitSampleTemplate.jsx');

const fontHref = (html) => {
  const m = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)" rel="stylesheet"/);
  return m ? m[1].replace(/&amp;/g, '&') : null;
};
const families = (href) => new URL(href).searchParams.getAll('family').map((f) => f.split(':')[0].replace(/\+/g, ' '));

describe('exportHtmlString', () => {
  it('keeps legacy templates on the old font list and phone grid override', async () => {
    // detailing_coastal is hidden and stays on the legacy path.
    const meta = buildTemplateMeta('detailing_coastal', {}, { bodyFont: "'Roboto', sans-serif" });
    const html = await exportHtmlString('detailing_coastal', full.businessInfo, full.generatedCopy, meta, full.images);
    const fams = families(fontHref(html));
    for (const f of LEGACY_EXPORT_FAMILIES) expect(fams).toContain(f);
    // The owner's custom font now loads on the live site too.
    expect(fams).toContain('Roboto');
    expect(html).toContain('div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }');
    expect(html).toContain(SITE_RUNTIME_JS);
    expect(html).toContain('html.acg-js [data-acg-reveal]');
  });

  it('gives theme-ready templates only their own fonts and no grid override', async () => {
    const meta = {
      ...SAMPLE_META,
      colors: { ...SAMPLE_META.colors, ...custom.customColors },
      font: custom.customFonts.font,
      bodyFont: custom.customFonts.bodyFont,
    };
    const html = await exportHtmlString('__kit_sample__', custom.businessInfo, custom.generatedCopy, meta, custom.images);
    // Owner fonts, plus Inter (body default) and Outfit for the free-tier
    // "Powered by" bar; none of the legacy 13-family list.
    expect(families(fontHref(html)).sort()).toEqual(['Inter', 'Manrope', 'Oswald', 'Outfit']);
    expect(html).not.toContain('grid-template-columns: 1fr !important');
    expect(html).toContain(SITE_RUNTIME_JS);
    expect(html).toContain('data-section="hero"');
    expect(html).not.toContain('data-acg-editor-only');

    const pro = await exportHtmlString('__kit_sample__', custom.businessInfo, custom.generatedCopy, meta, custom.images, [], null, true);
    expect(families(fontHref(pro)).sort()).toEqual(['Inter', 'Manrope', 'Oswald']);
    expect(pro).not.toContain('id="acg-powered-by"');
  });

  it('escapes head values', async () => {
    const biz = { ...full.businessInfo, businessName: 'Tom & Jerry\'s "Best" <Auto>' };
    const copy = {
      ...full.generatedCopy,
      metaTitle: 'Tom & Jerry <Detail> "Studio"',
      metaDescription: 'Fast & "friendly" </script><script>alert(1)</script>',
    };
    const meta = buildTemplateMeta('detailing_sporty');
    const html = await exportHtmlString('detailing_sporty', biz, copy, meta, {}, [], 'site-1');
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain('<title>Tom &amp; Jerry &lt;Detail&gt; "Studio"</title>');
    expect(head).toContain('<meta name="description" content="Fast &amp; &quot;friendly&quot; &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;" />');
    expect(head).toContain('<meta property="og:title" content="Tom &amp; Jerry\'s &quot;Best&quot; &lt;Auto&gt;" />');
    expect(head).not.toContain('&amp;quot;');
    // JSON-LD must not be able to close its own <script>.
    const ld = head.slice(head.indexOf('application/ld+json'));
    expect(ld).not.toMatch(/<\/script><script>alert/);
    expect(JSON.parse(ld.slice(ld.indexOf('{'), ld.lastIndexOf('}') + 1)).description).toBe(copy.metaDescription);
  });

  it('puts the container-query fallback in <head>, once, ahead of the runtime', async () => {
    for (const id of ['detailing_sporty', 'detailing_coastal']) {
      const html = await exportHtmlString(id, full.businessInfo, full.generatedCopy, buildTemplateMeta(id), full.images);
      const tag = `<script>${SITE_CQ_FALLBACK_JS}</script>`;
      expect(html.split(tag), id).toHaveLength(2);
      const at = html.indexOf(tag);
      expect(at).toBeGreaterThan(html.indexOf('<head>'));
      expect(at).toBeLessThan(html.indexOf(`<script>${SITE_RUNTIME_JS}</script>`));
      expect(at).toBeLessThan(html.indexOf('</head>'));
    }
  });

  it('adds the Before & After script only to a page that shows the band', async () => {
    const fx = FIXTURES.features;
    const meta = buildTemplateMeta('detailing_sporty');
    const tag = `<script>${SITE_BA_JS}</script>`;
    const head = (h) => h.slice(0, h.indexOf('</head>'));
    const withBand = await exportHtmlString('detailing_sporty', fx.businessInfo, fx.generatedCopy, meta, fx.images);
    expect(withBand.split(tag)).toHaveLength(2);
    expect(withBand.indexOf(tag)).toBeGreaterThan(withBand.indexOf(`<script>${SITE_RUNTIME_JS}</script>`));
    expect(withBand.indexOf(tag)).toBeLessThan(withBand.indexOf('</head>'));
    // Opt-in: without copy.beforeAfter the page carries no script and its
    // <head> is otherwise the same.
    const { beforeAfter: _ba, ...copy } = fx.generatedCopy;
    const without = await exportHtmlString('detailing_sporty', fx.businessInfo, copy, meta, fx.images);
    expect(without).not.toContain(SITE_BA_JS);
    expect(without).not.toContain('data-acg-ba');
    expect(head(withBand).replace(`\n  ${tag}`, '')).toBe(head(without));
    // Owner text that spells the input is escaped text, not the band.
    const spoof = await exportHtmlString('detailing_sporty', fx.businessInfo, { ...copy, subheadline: '<input data-acg-ba-range="">' }, meta, fx.images);
    expect(spoof).not.toContain(SITE_BA_JS);
    // Pages of the other templates never get it.
    const other = await exportHtmlString('mobile_chrome', fx.businessInfo, fx.generatedCopy, buildTemplateMeta('mobile_chrome'), fx.images);
    expect(other).not.toContain(SITE_BA_JS);
  });
});

// The fallback's rewrite, compiled from the shipped source text.
const rewrite = new Function(`return (${CQ_REWRITE_FN});`)();
const unescapeAttr = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// CSS without comments and string contents, for matching rules only.
const code = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
const count = (s, re) => (s.match(re) || []).length;
const CONTAINER_RULE = /@container(?![\w-])\s*([^{};]*)\{/g;
const CQ_UNIT = /(^|[^\w.\-\\[])-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?cq(?:min|max|[iwhb])(?![\w\-\\])/i;
const TWO_AXIS_CLIP = /(^|[^\w-])overflow\s*:\s*clip(?![\w-])(?!\s+[\w-])/i;
// The phone-menu rule as the rewrite emits it. MobileMenu.jsx already ships
// the same @media rule inside @supports not (container-type ...), so that
// block is stripped before counting or it would match with no rewrite.
const MENU_RULE = /@media \(max-width: ?600px\)\{\.acg-menu\{display:block\}\}/g;
const SUPPORTS_NOT_CQ = /@supports not \(container-type[^)]*\)\{@media[^{]*\{[^{}]*\{[^}]*\}\}\}/g;
const menuRules = (css) => count(css.replace(SUPPORTS_NOT_CQ, ''), MENU_RULE);
// What engines without Media Queries 4 (range syntax, or, nesting) can read.
const MQ3_WIDTH =/^\((?:min|max)-width:\s*\d+(?:\.\d+)?px\)(?:\s+and\s+\((?:min|max)-width:\s*\d+(?:\.\d+)?px\))*$/;

describe('container-query fallback on real templates', () => {
  it('turns every container rule and unit a template ships into ones old browsers read', async () => {
    let rules = 0;
    for (const id of Object.keys(TEMPLATE_COMPONENT_MAP)) {
      const mod = await TEMPLATE_COMPONENT_MAP[id]();
      for (const [name, fx] of Object.entries(FIXTURES)) {
        const meta = id === '__kit_sample__'
          ? { ...SAMPLE_META, colors: { ...SAMPLE_META.colors, ...fx.customColors } }
          : buildTemplateMeta(id, fx.customColors, fx.customFonts);
        const html = await exportHtmlString(id, fx.businessInfo, fx.generatedCopy, meta, fx.images);
        const where = `${id} / ${name}`;
        const sheets = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
        let menuRule = 0;
        for (const css of sheets) {
          const before = code(css);
          const preludes = [...before.matchAll(CONTAINER_RULE)].map((m) => m[1].trim());
          // Range syntax, "or" or style() would not survive as a media query
          // on the browsers this fallback is for: keep templates to min/max-width.
          for (const p of preludes) expect(p, `${where}: @container ${p}`).toMatch(MQ3_WIDTH);
          rules += preludes.length;
          const after = code(rewrite(css, true, true));
          expect(after, where).not.toMatch(/@container(?![\w-])/);
          expect(after, where).not.toMatch(CQ_UNIT);
          expect(after, where).not.toMatch(TWO_AXIS_CLIP);
          expect(count(after, /@media/g) - count(before, /@media/g), where).toBe(preludes.length);
          menuRule += menuRules(after) - menuRules(before);
        }
        for (const [, raw] of html.matchAll(/ style="([^"]*)"/g)) {
          expect(code(rewrite(unescapeAttr(raw), true, true)), where).not.toMatch(CQ_UNIT);
        }
        // The rewrite turns MobileMenu's @container rule into exactly one more
        // @media (max-width: 600px) rule, so the phone menu switches at a
        // 600px viewport, like the templates' own rules.
        if (mod.themeReady === true) expect(menuRule, `${where}: MobileMenu rule`).toBe(1);
      }
    }
    expect(rules).toBeGreaterThan(100);
  });
});
