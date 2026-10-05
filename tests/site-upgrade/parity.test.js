// The terminal tool builds exactly the page Admin > Site upgrades builds.
//
// Runs SiteUpgradesTab.jsx's own buildAndCheck (taken from its source, with
// its Supabase reads and admin-site-upgrade calls answered in memory) and
// the CLI's render path on the same inputs, for every template, and expects
// byte-identical pages, the same /book shell and the same verdict:
//   - in-process: scripts/site-upgrade/render.js in this test's module graph
//   - as the CLI runs it: load-render.js (Vite SSR, supabase stub, the
//     production origin shim), i.e. what `npm run site:upgrade` executes
// It also keeps the export's columns in step with what the tab reads.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../src/lib/supabase.js', () => import('../../scripts/site-upgrade/supabase-stub.js'));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP = 'https://sitebuilder.autocaregenius.com';
const STORAGE = 'https://ktnouhjikmlxlbxcxyif.supabase.co/storage/v1/object/public/site-images/0b1c2d3e';
const OWNER_ID = '0b1c2d3e-0000-4000-8000-000000000001';

const read = (p) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

// The tab's buildAndCheck and the columns it selects, from its source.
function tabSource() {
  const src = read('src/components/admin/SiteUpgradesTab.jsx');
  const fn = /\nasync function buildAndCheck\(siteId, appOrigin\) \{\n[\s\S]*?\n\}\n/.exec(src);
  const siteCols = /\nconst SITE_COLUMNS = '([^']+)';/.exec(src);
  const ownerCols = /\nconst OWNER_COLUMNS = '([^']+)';/.exec(src);
  if (!fn || !siteCols || !ownerCols) throw new Error('SiteUpgradesTab.jsx changed shape: update this test and the CLI with it');
  return { fn: fn[0], siteCols: siteCols[1], ownerCols: ownerCols[1] };
}
const cols = (s) => s.split(',').map((c) => c.trim());

let deps;
let cli;
let inputs;
let real;
let tab;

beforeAll(async () => {
  // As on the production app while exportHtml.js / bookingPageHtml.js load.
  vi.stubGlobal('window', { location: { origin: APP } });
  const [siteRender, exportHtml, bookingPage, gating, siteUpgrade] = await Promise.all([
    import('../../src/lib/siteRender.js'),
    import('../../src/lib/exportHtml.js'),
    import('../../src/lib/bookingPageHtml.js'),
    import('../../src/lib/subscriptionGating.js'),
    import('../../src/lib/siteUpgrade.js'),
  ]);
  vi.unstubAllGlobals();
  deps = {
    resolveSiteRender: siteRender.resolveSiteRender,
    applyWidgetKeys: siteRender.applyWidgetKeys,
    exportHtmlString: exportHtml.exportHtmlString,
    buildBookingPageHtml: bookingPage.buildBookingPageHtml,
    isEffectiveSchedulerActive: gating.isEffectiveSchedulerActive,
    checkUpgradedContent: siteUpgrade.checkUpgradedContent,
    eligibility: siteUpgrade.eligibility,
  };
  cli = await import('../../scripts/site-upgrade/render.js');
  inputs = await import('../../scripts/site-upgrade/inputs.js');
  const src = tabSource();
  tab = { ...src };
  tab.make = new Function('d', `const { supabase, upgradeApi, resolveSiteRender, applyWidgetKeys, exportHtmlString, buildBookingPageHtml, isEffectiveSchedulerActive, checkUpgradedContent, eligibility } = d;
const SITE_COLUMNS = ${JSON.stringify(src.siteCols)};
const OWNER_COLUMNS = ${JSON.stringify(src.ownerCols)};
${src.fn}
return buildAndCheck;`);
  const { startRenderer } = await import('../../scripts/site-upgrade/load-render.js');
  real = await startRenderer();
}, 120000);

afterAll(async () => { await real?.close(); });

// Runs the tab's buildAndCheck with its reads answered from `fullRow`,
// `ownerFull`, `widgets` and `live`.
async function runTab({ fullRow, ownerFull, widgets, live }) {
  const pick = (obj, list) => Object.fromEntries(cols(list).map((c) => [c, obj[c]]));
  const supabase = {
    from(table) {
      let selected = '';
      const q = {
        select(c) { selected = c; return q; },
        eq() { return q; },
        single: async () => (table === 'sites' ? { data: pick(fullRow, selected), error: null } : { data: null, error: { message: 'x' } }),
        maybeSingle: async () => ({ data: table === 'profiles' && ownerFull ? pick(ownerFull, selected) : null, error: null }),
      };
      return q;
    },
  };
  const upgradeApi = async (action) => {
    if (action === 'inputs') return { widgets };
    if (action === 'live') return live;
    throw new Error(`unexpected ${action}`);
  };
  return tab.make({ ...deps, supabase, upgradeApi })(fullRow.id, APP);
}

// The same site through the CLI: its inputs-file shape (export-inputs.sql),
// then render.js's build and check.
async function runCli(mod, { fullRow, ownerFull, widgets, live }) {
  const site = { ...fullRow, published_at: null, updated_at: '2026-10-01T00:00:00+00:00', fingerprint: 'f'.repeat(32), omittedImages: [] };
  const owner = ownerFull ? Object.fromEntries(inputs.OWNER_PLAN_COLUMNS.map((c) => [c, ownerFull[c]])) : null;
  const row = inputs.tabRow(site);
  const built = await mod.buildSitePage({ row, owner, widgets });
  const checked = mod.checkSitePage({ row, owner, built, live });
  return { built, checked };
}

let n = 0;
function caseFor(templateId, fx, { images, owner = 'pro', scheduler = false, widgets = [], widgetIds = [], extraCopy = {} } = {}) {
  n += 1;
  const id = `5a1e0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const slug = `parity-${n}`;
  const fullRow = {
    id, user_id: OWNER_ID, business_info: fx.businessInfo, template_id: templateId, slug,
    published_url: `https://${slug}.autocaregeniushub.com`, custom_domain: null, custom_domain_status: null,
    site_type: 'website', scheduler_enabled: scheduler, widget_config_ids: widgetIds, created_at: '2026-05-01T12:00:00+00:00',
    generated_content: { ...fx.generatedCopy, ...extraCopy, _images: images ?? fx.images, _customColors: fx.customColors, _customFonts: fx.customFonts },
  };
  const base = {
    id: OWNER_ID, email: 'owner@shop.test', first_name: 'Ana', last_name: 'Rivera', is_super_admin: false,
    scheduler_enabled: false, subscription_status: null, subscription_ends_at: null, stripe_first_failed_payment_at: null,
  };
  const ownerFull = owner === 'pro' ? { ...base, subscription_status: 'active' } : owner === 'free' ? base : null;
  return { fullRow, ownerFull, widgets };
}

const liveAnswer = (slug, html, extra = {}) => ({
  slug, shared: false,
  index: html == null ? { found: false } : { found: true, size: Buffer.byteLength(html), html },
  book: { found: false }, hold: null, ...extra,
});

function expectSame(t, c) {
  expect(c.built.newHtml).toBe(t.newHtml);
  expect(c.built.bookingPageHtml).toBe(t.bookingPageHtml);
  expect(c.built.isPro).toBe(t.isPro);
  expect(c.checked.liveHtml).toBe(t.liveHtml);
  expect(c.checked.verdict.status).toBe(t.summary.status);
  expect(c.checked.verdict.reasons).toEqual(t.summary.reasons);
  expect(c.checked.intended).toEqual(t.summary.intended);
}

describe('the CLI builds the page the Site upgrades tab builds', () => {
  const storageImages = {
    hero: `${STORAGE}/hero.jpg`, about: `${STORAGE}/about.jpg`, logo: `${STORAGE}/logo.png`,
    gallery0: `${STORAGE}/g0.jpg`, gallery1: `${STORAGE}/g1.jpg`, gallery2: `${STORAGE}/g2.jpg`,
  };

  it('for every template and fixture, against an old-design live page', async () => {
    const { TEMPLATE_COMPONENT_MAP } = await import('../../src/data/templates.js');
    const { FIXTURES } = await import('../../src/components/preview/templates/__fixtures__/businesses.js');
    const statuses = new Set();
    const variants = [
      { fx: 'full', opts: { images: storageImages, owner: 'pro', scheduler: true, widgets: [{ type: 'google-reviews', widget_key: 'gr-1' }, { type: 'instagram-feed', widget_key: 'ig-1' }] } },
      { fx: 'custom', opts: { owner: 'free' } },
      { fx: 'sparse', opts: { owner: null, widgetIds: ['0b1c2d3e-0000-4000-8000-0000000000aa'] } },
      { fx: 'features', opts: { images: storageImages, owner: 'free', scheduler: true } },
    ];
    // The fixtures this checkout has (the set grows with the templates).
    const present = variants.filter((v) => FIXTURES[v.fx]);
    expect(present.length).toBeGreaterThanOrEqual(3);
    for (const templateId of Object.keys(TEMPLATE_COMPONENT_MAP)) {
      for (const { fx, opts } of present) {
        const c = caseFor(templateId, FIXTURES[fx], opts);
        // An old-design live page: the same business on a legacy template.
        const old = caseFor('detailing_coastal', FIXTURES[fx], { ...opts, images: opts.images });
        const oldHtml = (await runTab({ ...old, live: liveAnswer(old.fullRow.slug, null) })).newHtml.replaceAll(old.fullRow.id, c.fullRow.id);
        const live = liveAnswer(c.fullRow.slug, oldHtml);
        const t = await runTab({ ...c, live });
        expect(t.newHtml, `${templateId}/${fx}`).toMatch(/^<!DOCTYPE html>/);
        expectSame(t, await runCli(cli, { ...c, live }));
        expectSame(t, await runCli(real.mod, { ...c, live }));
        statuses.add(t.summary.status);
      }
    }
    expect([...statuses]).toContain('flagged');
  }, 240000);

  it('when the live page is the new page itself (ready), and for every other live answer', async () => {
    const { FIXTURES } = await import('../../src/components/preview/templates/__fixtures__/businesses.js');
    const statuses = [];
    for (const templateId of ['mobile_chrome', 'detailing_sporty', 'mechanic_garage', 'tint_obsidian', 'carwash_bubble', 'mobile_redline', 'wheel_apex']) {
      const c = caseFor(templateId, FIXTURES.full, { images: storageImages, owner: 'pro', scheduler: true, widgets: [{ type: 'google-reviews', widget_key: 'gr-1' }] });
      const first = await runTab({ ...c, live: liveAnswer(c.fullRow.slug, null) });
      const answers = [
        liveAnswer(c.fullRow.slug, first.newHtml),
        liveAnswer(c.fullRow.slug, null),
        liveAnswer(c.fullRow.slug, null, { index: { found: true, size: 4_000_000, tooLarge: true } }),
        liveAnswer(c.fullRow.slug, first.newHtml, { shared: true }),
        liveAnswer(c.fullRow.slug, first.newHtml, { hold: { held: true, reason: 'restored', note: null, at: '2026-10-03T00:00:00.000Z', by: null, backupId: 'b' } }),
      ];
      for (const live of answers) {
        const t = await runTab({ ...c, live });
        expectSame(t, await runCli(cli, { ...c, live }));
        expectSame(t, await runCli(real.mod, { ...c, live }));
        statuses.push(t.summary.status);
      }
    }
    expect(statuses).toContain('ready');
    expect(statuses).toContain('flagged');
  }, 240000);

  it('for an unknown template (no page) and an owner on the manual check list', async () => {
    const { FIXTURES } = await import('../../src/components/preview/templates/__fixtures__/businesses.js');
    const { UPGRADE_MANUAL_SKIP } = await import('../../src/lib/siteUpgrade.js');
    const unknown = caseFor('no_such_template', FIXTURES.full, { owner: 'free' });
    const live = liveAnswer(unknown.fullRow.slug, '<!DOCTYPE html><html><body>old</body></html>');
    const t = await runTab({ ...unknown, live });
    expect(t.newHtml).toBeNull();
    expectSame(t, await runCli(cli, { ...unknown, live }));
    expectSame(t, await runCli(real.mod, { ...unknown, live }));

    const skipped = caseFor('mobile_chrome', FIXTURES.full, { owner: 'pro' });
    skipped.fullRow.id = UPGRADE_MANUAL_SKIP[0].siteId;
    const t2 = await runTab({ ...skipped, live: liveAnswer(skipped.fullRow.slug, null) });
    expect(t2.summary.reasons[0].code).toBe('manual_skip');
    expectSame(t2, await runCli(real.mod, { ...skipped, live: liveAnswer(skipped.fullRow.slug, null) }));
  }, 120000);

  it('bakes the production app into the widget URLs, as the production app does', async () => {
    expect(real.mod.widgetOrigin()).toBe(APP);
    expect(globalThis.window).toBeUndefined();
  });
});

describe('the export holds what the tab reads', () => {
  it('selects the tab\'s site columns plus generated_content, and the owner plan columns', () => {
    const { siteCols, ownerCols } = tabSource();
    expect(inputs.TAB_SITE_COLUMNS).toEqual([...cols(siteCols), 'generated_content']);
    for (const c of inputs.OWNER_PLAN_COLUMNS) expect(cols(ownerCols)).toContain(c);
    const sql = read('scripts/site-upgrade/export-inputs.sql');
    for (const c of inputs.TAB_SITE_COLUMNS) {
      expect(sql).toContain(c === 'generated_content' ? "'generated_content', r.generated_content_export" : `'${c}', r.${c}`);
    }
    for (const c of inputs.OWNER_PLAN_COLUMNS) expect(sql).toContain(`'${c}', p.${c}`);
  });

  it('the plan columns are all isEffectiveSchedulerActive reads', () => {
    const src = read('src/lib/subscriptionGating.js');
    const body = /export function isEffectiveSchedulerActive\(profile\) \{([\s\S]*?)\n\}/.exec(src)[1];
    const used = new Set([...body.matchAll(/profile\.([a-z_]+)/g)].map((m) => m[1]));
    for (const c of used) expect(inputs.OWNER_PLAN_COLUMNS).toContain(c);
  });
});
