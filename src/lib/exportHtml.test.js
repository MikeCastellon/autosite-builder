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
const { SITE_RUNTIME_JS } = await import('./siteRuntime.js');
const { LEGACY_EXPORT_FAMILIES } = await import('./fontCatalog.js');
const { full, custom } = await import('../components/preview/templates/__fixtures__/businesses.js');
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
});
