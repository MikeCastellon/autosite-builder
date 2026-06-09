# Standalone Booking Service — Implementation Plan (Feature 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a business publish a standalone, themeable, full-page booking experience to its own subdomain/slug (and `/book` for sites that also have a website), reusing the existing R2 publish pipeline — no website required.

**Architecture:** A booking-only account is a lightweight `sites` row (`site_type = 'booking_only'`). The published booking page is a thin HTML shell that loads `public/scheduler.js` in a new **full-page mode**; the widget fetches `scheduler-config` at runtime (including a new `appearance` block) and renders the branded/minimal flow. Theme/service changes therefore need no republish. Booking-only users get a short setup flow; the dashboard exposes a shareable link + QR code.

**Tech Stack:** React 19 (state-based navigation, no router), Tailwind (tokens in `src/design-tokens.js`), Supabase JS, Netlify functions, Cloudflare R2, `qrcode.react`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-booking-platform-v3-design.md`

---

## File Structure

**Create:**
- `db/migrations/20260609_site_type.sql` — `sites.site_type` column
- `src/lib/bookingPageHtml.js` — builds the standalone booking-page HTML shell
- `src/lib/bookingPageHtml.test.js` — tests for the shell builder
- `src/components/dashboard/booking-settings/AppearanceTab.jsx` — theming editor
- `src/components/dashboard/booking-only/BookingOnlySetup.jsx` — short setup flow for booking-only accounts
- `src/components/dashboard/booking-only/ShareBookingCard.jsx` — link + copy + QR
- `tests/functions/scheduler-config-appearance.test.js` — appearance in config payload

**Modify:**
- `src/lib/schedulerConfig.js` — `defaultAppearance()`, `normalizeAppearance()`, include in defaults
- `src/lib/schedulerConfig.test.js` (create if absent) — appearance unit tests
- `netlify/functions/scheduler-config.js` — return `appearance` + `site_type`
- `netlify/functions/publish-site.js` — optional `bookingPageHtml` → also write `${slug}/book/index.html`
- `src/lib/publishSite.js` — `publishBookingPage()` helper
- `public/scheduler.js` — full-page render mode driven by `appearance`
- `src/lib/exportHtml.js` — inject `/book` link awareness is automatic; no change needed beyond verifying the widget script tag (verification step only)
- `src/components/dashboard/booking-settings/BookingSettingsPage.jsx` + `SchedulerSettings.jsx` — add Appearance tab
- `src/App.jsx` — onboarding choice (Website / Booking page / Both) + `view` wiring
- `src/components/dashboard/DashboardPage.jsx` — render ShareBookingCard for booking sites

---

## Group A — Data model & config foundation

### Task 1: Add `site_type` column to `sites`

**Files:**
- Create: `db/migrations/20260609_site_type.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Standalone booking service: distinguish booking-only accounts from
-- full websites. Booking-only rows publish a single booking page and
-- skip website content generation. Reuses all existing scheduler infra.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.sites
  add column if not exists site_type text not null default 'website';

-- Guard the allowed values without blocking legacy rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sites_site_type_check'
  ) then
    alter table public.sites
      add constraint sites_site_type_check
      check (site_type in ('website', 'booking_only'));
  end if;
end $$;

commit;
```

- [ ] **Step 2: Apply it**

Apply the SQL in the Supabase SQL editor (postgres role). Verify:

Run (Supabase SQL editor):
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'sites' and column_name = 'site_type';
```
Expected: one row, `text`, default `'website'::text`.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/20260609_site_type.sql
git commit -m "feat(db): add sites.site_type for booking-only accounts"
```

---

### Task 2: Appearance config defaults + normalization

**Files:**
- Modify: `src/lib/schedulerConfig.js`
- Test: `src/lib/schedulerConfig.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/schedulerConfig.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { defaultAppearance, normalizeAppearance, defaultSchedulerConfig } from './schedulerConfig.js';

describe('appearance', () => {
  it('default appearance has all themeable fields', () => {
    const a = defaultAppearance();
    expect(a).toEqual({
      page_style: 'branded',
      accent_color: '#1a1a1a',
      background: 'light',
      background_image_url: '',
      corner_style: 'rounded',
      font: 'Inter',
      logo_url: '',
      tagline: '',
    });
  });

  it('defaultSchedulerConfig includes appearance', () => {
    expect(defaultSchedulerConfig().appearance).toEqual(defaultAppearance());
  });

  it('normalizeAppearance fills missing fields and rejects bad enums', () => {
    const a = normalizeAppearance({ page_style: 'minimal', accent_color: '#ff0000', background: 'bogus' });
    expect(a.page_style).toBe('minimal');
    expect(a.accent_color).toBe('#ff0000');
    expect(a.background).toBe('light'); // bad enum falls back
    expect(a.corner_style).toBe('rounded'); // missing → default
  });

  it('normalizeAppearance coerces a non-object to defaults', () => {
    expect(normalizeAppearance(undefined)).toEqual(defaultAppearance());
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/schedulerConfig.test.js`
Expected: FAIL — `defaultAppearance is not a function`.

- [ ] **Step 3: Implement in `src/lib/schedulerConfig.js`**

Add near the top (after `formatCentsAsDisplay`):
```javascript
const APPEARANCE_ENUMS = {
  page_style: ['branded', 'minimal'],
  background: ['light', 'dark', 'image'],
  corner_style: ['rounded', 'sharp'],
};

export function defaultAppearance() {
  return {
    page_style: 'branded',
    accent_color: '#1a1a1a',
    background: 'light',
    background_image_url: '',
    corner_style: 'rounded',
    font: 'Inter',
    logo_url: '',
    tagline: '',
  };
}

export function normalizeAppearance(input) {
  const base = defaultAppearance();
  if (!input || typeof input !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const val = input[key];
    if (val == null) continue;
    if (APPEARANCE_ENUMS[key]) {
      if (APPEARANCE_ENUMS[key].includes(val)) out[key] = val;
    } else if (typeof val === 'string') {
      out[key] = val;
    }
  }
  return out;
}
```

Then add `appearance: defaultAppearance(),` to the object returned by `defaultSchedulerConfig()` (place it after `services: [],`).

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/lib/schedulerConfig.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedulerConfig.js src/lib/schedulerConfig.test.js
git commit -m "feat(scheduler): appearance config defaults + normalization"
```

---

## Group B — Serve appearance to the widget

### Task 3: Return `appearance` and `site_type` from scheduler-config

**Files:**
- Modify: `netlify/functions/scheduler-config.js`
- Test: `tests/functions/scheduler-config-appearance.test.js` (create)

> Note: `scheduler-config.js` calls Supabase directly inside the handler, which is awkward to unit-test. Extract the payload-building into a pure helper and test that.

- [ ] **Step 1: Write the failing test**

Create `tests/functions/scheduler-config-appearance.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { buildSchedulerPayload } from '../../netlify/functions/_lib/scheduler-payload.js';

describe('buildSchedulerPayload appearance', () => {
  const site = {
    business_info: { businessName: 'Joe Detailing', city: 'Austin' },
    generated_content: {},
    template_id: 'default',
    site_type: 'booking_only',
    scheduler_config: {
      appearance: { page_style: 'minimal', accent_color: '#2563eb', tagline: 'At your door' },
      services: [],
      availability: {},
    },
  };

  it('includes a normalized appearance block', () => {
    const p = buildSchedulerPayload(site);
    expect(p.appearance.page_style).toBe('minimal');
    expect(p.appearance.accent_color).toBe('#2563eb');
    expect(p.appearance.tagline).toBe('At your door');
    expect(p.appearance.corner_style).toBe('rounded'); // filled default
  });

  it('echoes site_type', () => {
    expect(buildSchedulerPayload(site).site_type).toBe('booking_only');
  });

  it('defaults site_type to website', () => {
    expect(buildSchedulerPayload({ ...site, site_type: undefined }).site_type).toBe('website');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/functions/scheduler-config-appearance.test.js`
Expected: FAIL — cannot find module `_lib/scheduler-payload.js`.

- [ ] **Step 3: Extract the payload builder**

Create `netlify/functions/_lib/scheduler-payload.js`:
```javascript
import { servicePriceCents } from './deposit-math.js';
import { normalizeAppearance } from './appearance.js';

function formatCents(cents) {
  if (typeof cents !== 'number' || cents <= 0) return '';
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

const TEMPLATE_FALLBACK_COLORS = { default: '#1a1a1a' };

// Pure builder: takes a `sites` row, returns the public widget payload.
// No DB / network — unit testable.
export function buildSchedulerPayload(site) {
  const businessName = site.business_info?.businessName || 'Book Now';
  const customColors = site.generated_content?._customColors || {};
  const brandColor =
    customColors.primary ||
    customColors.accent ||
    TEMPLATE_FALLBACK_COLORS[site.template_id] ||
    TEMPLATE_FALLBACK_COLORS.default;

  const cfg = site.scheduler_config || {};
  const appearance = normalizeAppearance(cfg.appearance);
  const enabledServices = (cfg.services || []).filter((s) => s.enabled !== false);
  const siteLogo = site.generated_content?._images?.logo || null;
  const logoUrl = appearance.logo_url || cfg.logo_url || siteLogo || null;

  return {
    enabled: true,
    site_type: site.site_type || 'website',
    businessName,
    brandColor,
    appearance,
    logo_url: logoUrl,
    city: site.business_info?.city || '',
    booking_mode: cfg.booking_mode === 'simple' ? 'simple' : 'full',
    modal_theme: cfg.modal_theme || 'light',
    welcome_text: cfg.welcome_text || "Tell us about your car and we'll be in touch.",
    button_label: cfg.button_label || 'Book Now',
    lead_time_hours: cfg.lead_time_hours ?? 24,
    slot_granularity_minutes: cfg.slot_granularity_minutes ?? 30,
    cta_selector: cfg.cta_selector || '',
    cancellation_policy: cfg.cancellation_policy || '',
    services: enabledServices.map((s) => {
      const cents = servicePriceCents(s);
      const enabledAddons = Array.isArray(s.addons)
        ? s.addons
            .filter((a) => a && a.enabled !== false && typeof a.name === 'string' && a.name.trim() !== '')
            .map((a) => ({
              id: a.id,
              name: a.name,
              price_cents: typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0,
            }))
        : [];
      return {
        id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price ?? (cents != null ? formatCents(cents) : ''),
        price_cents: cents,
        description: s.description ?? '',
        addons: enabledAddons,
      };
    }),
    availability: cfg.availability || {},
  };
}
```

Create `netlify/functions/_lib/appearance.js` — a server copy of the normalizer (functions can't import from `src/`; this mirror is intentional, like `deposit-math.js` is mirrored in `schedulerConfig.js`):
```javascript
const APPEARANCE_ENUMS = {
  page_style: ['branded', 'minimal'],
  background: ['light', 'dark', 'image'],
  corner_style: ['rounded', 'sharp'],
};

export function defaultAppearance() {
  return {
    page_style: 'branded',
    accent_color: '#1a1a1a',
    background: 'light',
    background_image_url: '',
    corner_style: 'rounded',
    font: 'Inter',
    logo_url: '',
    tagline: '',
  };
}

export function normalizeAppearance(input) {
  const base = defaultAppearance();
  if (!input || typeof input !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const val = input[key];
    if (val == null) continue;
    if (APPEARANCE_ENUMS[key]) {
      if (APPEARANCE_ENUMS[key].includes(val)) out[key] = val;
    } else if (typeof val === 'string') {
      out[key] = val;
    }
  }
  return out;
}
```

- [ ] **Step 4: Wire the builder into the handler**

In `netlify/functions/scheduler-config.js`:
1. Add to imports: `import { buildSchedulerPayload } from './_lib/scheduler-payload.js';`
2. Change the SELECT (line 47-51) to include `site_type`:
```javascript
    .select('id, user_id, business_info, generated_content, template_id, site_type, scheduler_enabled, scheduler_config')
```
3. Replace the entire `return { statusCode: 200, headers: CORS, body: JSON.stringify({ ... }) };` block (lines 78-119) with:
```javascript
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify(buildSchedulerPayload(site)),
  };
```
4. Remove the now-unused `formatCents` and `TEMPLATE_FALLBACK_COLORS` from this file (they live in the helper now), and the now-unused `servicePriceCents` import.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/functions/scheduler-config-appearance.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/scheduler-payload.js netlify/functions/_lib/appearance.js netlify/functions/scheduler-config.js tests/functions/scheduler-config-appearance.test.js
git commit -m "feat(scheduler): serve appearance + site_type from scheduler-config"
```

---

### Task 4: Full-page render mode in `public/scheduler.js`

**Files:**
- Modify: `public/scheduler.js`
- Smoke test: `docs/superpowers/smoke-tests/standalone-booking-page.md` (create)

> The widget is plain browser JS rendered visually; verify via smoke test, not unit test. The full-page branch reuses the existing inline modal render (`openModal(cfg, { inline: true })`) inside a branded wrapper built from `cfg.appearance`.

- [ ] **Step 1: Add full-page detection**

In `public/scheduler.js`, after the `autoOpen` block (around line 17), add:
```javascript
  var fullPage = script && script.getAttribute('data-full-page') === 'true';
```

- [ ] **Step 2: Add the full-page branch to the render decision**

Replace the render decision tree (currently lines 29-34):
```javascript
      if (!cfg || !cfg.enabled) return;
      if (fullPage) renderFullPage(cfg);
      else if (previewMode) openModal(cfg, { inline: true });
      else if (autoOpen) openModal(cfg, { inline: false });
      else mountButton(cfg);
```

- [ ] **Step 3: Implement `renderFullPage`**

Add this function (place it just above `mountButton`):
```javascript
  function renderFullPage(cfg) {
    var a = cfg.appearance || {};
    var accent = a.accent_color || cfg.brandColor || '#1a1a1a';
    var radius = a.corner_style === 'sharp' ? '0px' : '16px';
    var dark = a.background === 'dark';
    var pageBg = dark ? '#0f1115' : '#f0f1f3';
    var cardBg = dark ? '#1b1e24' : '#ffffff';
    var textColor = dark ? '#f5f6f8' : '#1a1a1a';
    if (a.background === 'image' && a.background_image_url) {
      pageBg = "#0f1115 url('" + a.background_image_url + "') center/cover no-repeat";
    }
    var fontFamily = (a.font || 'Inter') + ",-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

    document.body.style.margin = '0';
    document.body.style.background = pageBg;
    document.body.style.fontFamily = fontFamily;
    document.body.style.minHeight = '100vh';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:520px;margin:0 auto;padding:32px 16px 64px;box-sizing:border-box;';

    if (a.page_style !== 'minimal') {
      // Branded: hero with business name + tagline.
      var hero = document.createElement('div');
      hero.style.cssText =
        'border-radius:' + radius + ';overflow:hidden;margin-bottom:18px;color:#fff;' +
        'background:linear-gradient(135deg,' + accent + ',rgba(0,0,0,0.55));padding:28px 24px;';
      var nameEl = document.createElement('div');
      nameEl.textContent = cfg.businessName || 'Book an appointment';
      nameEl.style.cssText = 'font-weight:800;font-size:22px;line-height:1.15;';
      hero.appendChild(nameEl);
      if (a.tagline) {
        var tagEl = document.createElement('div');
        tagEl.textContent = a.tagline;
        tagEl.style.cssText = 'opacity:0.85;font-size:13px;margin-top:6px;';
        hero.appendChild(tagEl);
      }
      wrap.appendChild(hero);
    } else {
      // Minimal: centered logo/name header.
      var head = document.createElement('div');
      head.style.cssText = 'text-align:center;margin-bottom:18px;color:' + textColor + ';';
      if (cfg.logo_url) {
        var img = document.createElement('img');
        img.src = cfg.logo_url;
        img.alt = '';
        img.style.cssText = 'width:56px;height:56px;border-radius:50%;object-fit:cover;margin:0 auto 10px;display:block;';
        head.appendChild(img);
      }
      var h = document.createElement('div');
      h.textContent = cfg.businessName || 'Book an appointment';
      h.style.cssText = 'font-weight:800;font-size:20px;';
      head.appendChild(h);
      wrap.appendChild(head);
    }

    var host = document.createElement('div');
    host.id = 'acg-scheduler-preview-host';
    host.style.cssText = 'background:' + cardBg + ';color:' + textColor + ';border-radius:' + radius +
      ';box-shadow:0 12px 36px rgba(0,0,0,0.12);overflow:hidden;';
    wrap.appendChild(host);
    document.body.appendChild(wrap);

    // Reuse the existing inline render path; it mounts into
    // #acg-scheduler-preview-host when present.
    openModal(cfg, { inline: true });
  }
```

> Implementation note: confirm `openModal(cfg, { inline: true })` mounts into `#acg-scheduler-preview-host`. The Explore map shows it renders "inside `#acg-scheduler-preview-host` or body" — if it only checks `previewMode`, adjust the inline branch of `openModal` to look up `document.getElementById('acg-scheduler-preview-host')` as the host and append the rendered step container there. Do not change modal behavior for the non-inline path.

- [ ] **Step 4: Write the smoke test doc**

Create `docs/superpowers/smoke-tests/standalone-booking-page.md`:
```markdown
# Smoke test: standalone booking page

1. Run `npm run dev`.
2. In a scratch HTML file (or temporary route), add:
   `<script src="http://localhost:5173/scheduler.js" data-site-id="<A_BOOKING_ENABLED_SITE_ID>" data-full-page="true" defer></script>`
3. Open it. Expect: a full-page booking experience (not a floating button).
   - Branded style → hero banner with business name + tagline.
   - Minimal style → centered logo/name, then the booking card.
4. Toggle appearance in Booking Settings → Appearance, reload the page,
   confirm accent color, corner style, light/dark background update WITHOUT republishing.
5. Complete a booking; confirm it appears in the dashboard Bookings list.
```

- [ ] **Step 5: Build to confirm no syntax errors**

Run: `npm run build`
Expected: build succeeds (Vite copies `public/scheduler.js` to `dist/` unchanged).

- [ ] **Step 6: Commit**

```bash
git add public/scheduler.js docs/superpowers/smoke-tests/standalone-booking-page.md
git commit -m "feat(scheduler): full-page booking render mode driven by appearance"
```

---

## Group C — Publish pipeline for booking pages

### Task 5: Booking-page HTML shell builder

**Files:**
- Create: `src/lib/bookingPageHtml.js`
- Test: `src/lib/bookingPageHtml.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bookingPageHtml.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { buildBookingPageHtml, SCHEDULER_WIDGET_URL } from './bookingPageHtml.js';

describe('buildBookingPageHtml', () => {
  const html = buildBookingPageHtml({ siteId: 'abc-123', businessName: "Joe's Detailing" });

  it('is a full HTML document', () => {
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<meta name="viewport"');
  });

  it('loads scheduler.js in full-page mode for the site', () => {
    expect(html).toContain(SCHEDULER_WIDGET_URL);
    expect(html).toContain('data-site-id="abc-123"');
    expect(html).toContain('data-full-page="true"');
  });

  it('escapes the business name in the <title>', () => {
    const x = buildBookingPageHtml({ siteId: 's', businessName: '<script>x</script>' });
    expect(x).not.toContain('<title><script>x</script>');
    expect(x).toContain('&lt;script&gt;');
  });

  it('shows a no-JS fallback message', () => {
    expect(html).toContain('<noscript>');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/bookingPageHtml.test.js`
Expected: FAIL — cannot find module `./bookingPageHtml.js`.

- [ ] **Step 3: Implement**

Create `src/lib/bookingPageHtml.js`:
```javascript
// Builds the thin HTML shell published for a standalone booking page.
// The shell loads scheduler.js in full-page mode; all config + theming
// is fetched at runtime, so theme/service edits never need a republish.

export const SCHEDULER_WIDGET_URL =
  (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://app.autocaregenius.com') + '/scheduler.js';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildBookingPageHtml({ siteId, businessName }) {
  const title = escapeHtml(businessName || 'Book an appointment');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="robots" content="index,follow">
<style>body{margin:0;background:#f0f1f3;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.acg-loading{display:flex;min-height:100vh;align-items:center;justify-content:center;color:#888;font-size:14px}</style>
</head>
<body>
<div class="acg-loading">Loading booking…</div>
<noscript>Please enable JavaScript to book an appointment.</noscript>
<script src="${SCHEDULER_WIDGET_URL}" data-site-id="${escapeHtml(siteId)}" data-full-page="true" defer></script>
</body>
</html>`;
}
```

> The widget removes `.acg-loading` when it renders. Add to `renderFullPage` (Task 4) as its first line: `var loading = document.querySelector('.acg-loading'); if (loading) loading.remove();`

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/bookingPageHtml.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bookingPageHtml.js src/lib/bookingPageHtml.test.js
git commit -m "feat(booking): standalone booking page HTML shell builder"
```

---

### Task 6: Publish booking page (root for booking-only, `/book` for sites)

**Files:**
- Modify: `netlify/functions/publish-site.js`
- Modify: `src/lib/publishSite.js`

- [ ] **Step 1: Extend the publish function to accept an optional booking page**

In `netlify/functions/publish-site.js`:
1. Update the destructure (line 23):
```javascript
  const { siteId, htmlContent, slug, bookingPageHtml } = body;
```
2. After the successful main upload + before computing `publishedUrl` (after line 66), add:
```javascript
    // Optionally publish the booking page at `${slug}/book/index.html`
    // for sites that have BOTH a website and a booking page. (For
    // booking-only accounts, htmlContent IS the booking shell at root.)
    if (bookingPageHtml) {
      const bookingKey = `${slug}/book/index.html`;
      const bookingR2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(bookingKey)}`;
      const bookingRes = await fetch(bookingR2Url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'text/html; charset=utf-8' },
        body: bookingPageHtml,
      });
      if (!bookingRes.ok) {
        const t = await bookingRes.text();
        throw new Error(`R2 booking-page upload failed (${bookingRes.status}): ${t}`);
      }
    }
```
3. Update the response to surface the booking URL:
```javascript
    const publishedUrl = `https://${slug}.${PUBLISH_DOMAIN}`;
    const bookingUrl = bookingPageHtml ? `${publishedUrl}/book` : publishedUrl;
```
and change the success body to `JSON.stringify({ publishedUrl, bookingUrl })`.

- [ ] **Step 2: Add a client helper for booking-only publish**

In `src/lib/publishSite.js`, add (keep the existing `publishSite` export):
```javascript
import { buildBookingPageHtml } from './bookingPageHtml.js';

/**
 * Publish a standalone booking page.
 * - Booking-only account: the booking shell IS the root index.html.
 * - Website account: pass `asSubpath: true` to also write `${slug}/book`.
 */
export async function publishBookingPage({ siteId, businessName, slug, asSubpath = false }) {
  const shell = buildBookingPageHtml({ siteId, businessName });

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required to publish.');

  const payload = asSubpath
    ? { siteId, htmlContent: '<!-- website already published -->', slug, bookingPageHtml: shell }
    : { siteId, htmlContent: shell, slug };

  const res = await fetch('/.netlify/functions/publish-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Publish failed');
  }
  return res.json(); // { publishedUrl, bookingUrl }
}
```

> Note for `asSubpath: true`: passing a placeholder `htmlContent` would overwrite the site's real homepage. Instead, when a website already exists, the caller (Task 9/10) should re-run the normal `publishSite()` for the homepage and separately call a `/book`-only publish. To keep the homepage intact, change the function so `asSubpath` omits `htmlContent` and update `publish-site.js` to treat a missing `htmlContent` **with** a present `bookingPageHtml` as "only write the /book object" (skip the root upload and the `slug !== site.slug` homepage rules still apply). Implement that branch:
> In `publish-site.js`, guard the root upload: `if (htmlContent) { ...existing root upload... }` and require `htmlContent || bookingPageHtml` instead of `htmlContent` in the validation on line 24.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/publish-site.js src/lib/publishSite.js
git commit -m "feat(publish): publish booking page at root or /book subpath"
```

---

## Group D — Setup, appearance editor, onboarding, share UI

### Task 7: Appearance editor tab

**Files:**
- Create: `src/components/dashboard/booking-settings/AppearanceTab.jsx`
- Modify: `src/components/dashboard/booking-settings/SchedulerSettings.jsx` (add the tab)

- [ ] **Step 1: Build the AppearanceTab component**

Create `src/components/dashboard/booking-settings/AppearanceTab.jsx`. Mirror `GeneralTab.jsx` conventions (same `labelBase`/`inputBase`/`helpBase` classes, `saveSchedulerConfig`, `onSaved`). Full content:
```jsx
import { useState } from 'react';
import { saveSchedulerConfig, defaultAppearance, normalizeAppearance } from '../../../lib/schedulerConfig.js';

const labelBase = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1.5 uppercase tracking-[0.5px]';
const helpBase = 'text-[12px] text-[#888] mt-1.5 leading-relaxed';
const inputBase = 'w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[14px]';

const SWATCHES = ['#1a1a1a', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c'];
const FONTS = ['Inter', 'Outfit', 'Poppins', 'Roboto', 'Georgia'];

export default function AppearanceTab({ siteId, config, onSaved }) {
  const [a, setA] = useState(() => normalizeAppearance(config?.appearance));
  const [saving, setSaving] = useState(false);

  function set(patch) { setA((prev) => ({ ...prev, ...patch })); }

  async function persist(next) {
    setSaving(true);
    try {
      const updated = await saveSchedulerConfig(siteId, { appearance: next });
      onSaved && onSaved(updated);
    } finally { setSaving(false); }
  }

  function commit(patch) {
    const next = { ...a, ...patch };
    setA(next);
    persist(next);
  }

  return (
    <div className="max-w-[560px]">
      <label className={labelBase}>Page style</label>
      <div className="flex gap-2 mb-5">
        {['minimal', 'branded'].map((v) => (
          <button key={v} type="button" onClick={() => commit({ page_style: v })}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${a.page_style === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10 text-[#1a1a1a]'}`}>
            {v}
          </button>
        ))}
      </div>

      <label className={labelBase}>Accent color</label>
      <div className="flex items-center gap-2 mb-1.5">
        {SWATCHES.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => commit({ accent_color: c })}
            style={{ background: c }}
            className={`w-7 h-7 rounded-lg ${a.accent_color === c ? 'ring-2 ring-offset-2 ring-[#1a1a1a]' : ''}`} />
        ))}
        <input type="color" value={a.accent_color} onChange={(e) => set({ accent_color: e.target.value })}
          onBlur={(e) => commit({ accent_color: e.target.value })} className="w-9 h-9 rounded-lg border border-black/10 p-0.5" />
        <input type="text" value={a.accent_color} onChange={(e) => set({ accent_color: e.target.value })}
          onBlur={(e) => commit({ accent_color: e.target.value })} className="w-28 border border-black/10 rounded-xl px-2.5 py-2 text-[13px] font-mono" />
      </div>
      <p className={helpBase}>Pick a preset, use the picker, or type a hex code.</p>

      <label className={`${labelBase} mt-5`}>Background</label>
      <div className="flex gap-2 mb-2">
        {['light', 'dark', 'image'].map((v) => (
          <button key={v} type="button" onClick={() => commit({ background: v })}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${a.background === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10 text-[#1a1a1a]'}`}>
            {v}
          </button>
        ))}
      </div>
      {a.background === 'image' && (
        <input type="url" placeholder="https://…/background.jpg" value={a.background_image_url}
          onChange={(e) => set({ background_image_url: e.target.value })}
          onBlur={(e) => commit({ background_image_url: e.target.value })} className={`${inputBase} mb-2`} />
      )}

      <label className={`${labelBase} mt-3`}>Corner style</label>
      <div className="flex gap-2 mb-5">
        {['rounded', 'sharp'].map((v) => (
          <button key={v} type="button" onClick={() => commit({ corner_style: v })}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${a.corner_style === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10 text-[#1a1a1a]'}`}>
            {v}
          </button>
        ))}
      </div>

      <label className={labelBase}>Font</label>
      <select value={a.font} onChange={(e) => commit({ font: e.target.value })} className={`${inputBase} mb-5`}>
        {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>

      <label className={labelBase}>Tagline (branded style)</label>
      <input type="text" value={a.tagline} onChange={(e) => set({ tagline: e.target.value })}
        onBlur={(e) => commit({ tagline: e.target.value })} placeholder="Premium car care, at your door" className={inputBase} />
      <p className={helpBase}>{saving ? 'Saving…' : 'Changes save automatically and apply live — no republish needed.'}</p>
    </div>
  );
}
```

- [ ] **Step 2: Register the tab in SchedulerSettings**

Open `src/components/dashboard/booking-settings/SchedulerSettings.jsx`. It renders the tab strip and the loaded `config`. Follow the existing tab pattern (it already mounts `GeneralTab`, `ServicesTab`, `AvailabilityTab`):
- Import `AppearanceTab`.
- Add an `'appearance'` entry to the tab list with label `Appearance`.
- In the tab body switch, render `<AppearanceTab siteId={siteId} config={config} onSaved={handleSaved} />` using the same `config`/`onSaved` props the other tabs receive.

(Read the file first to match its exact tab-state variable and `onSaved` handler name.)

- [ ] **Step 3: Verify build + run existing tests**

Run: `npm run build && npx vitest run`
Expected: build succeeds; existing test suite still passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/booking-settings/AppearanceTab.jsx src/components/dashboard/booking-settings/SchedulerSettings.jsx
git commit -m "feat(booking-settings): appearance editor tab"
```

---

### Task 8: Share card — link + copy + QR

**Files:**
- Create: `src/components/dashboard/booking-only/ShareBookingCard.jsx`

- [ ] **Step 1: Build the component**

Create `src/components/dashboard/booking-only/ShareBookingCard.jsx`:
```jsx
import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const cardBase = 'bg-white border border-black/10 rounded-2xl p-5 shadow-sm';
const labelBase = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1.5 uppercase tracking-[0.5px]';
const btnBase = 'rounded-xl px-3.5 py-2 text-[13px] font-semibold border border-black/10 hover:bg-black/[0.03] transition';

// bookingUrl: the public link to share (root for booking-only, /book for sites).
export default function ShareBookingCard({ bookingUrl }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!bookingUrl) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — user can select manually */ }
  }

  return (
    <div className={cardBase}>
      <label className={labelBase}>Your booking link</label>
      <div className="flex items-center gap-2 mb-3">
        <input readOnly value={bookingUrl} onFocus={(e) => e.target.select()}
          className="flex-1 border border-black/10 rounded-xl px-3 py-2 text-[13px] font-mono bg-[#faf9f7]" />
        <button type="button" className={btnBase} onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        <button type="button" className={btnBase} onClick={() => setShowQr((v) => !v)}>{showQr ? 'Hide QR' : 'QR code'}</button>
      </div>
      <p className="text-[12px] text-[#888] leading-relaxed">Drop this in your Instagram bio so customers can book directly.</p>
      {showQr && (
        <div className="mt-4 flex justify-center">
          <QRCodeCanvas value={bookingUrl} size={160} includeMargin />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success (`qrcode.react` is already a dependency).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/booking-only/ShareBookingCard.jsx
git commit -m "feat(booking): shareable link card with copy + QR"
```

---

### Task 9: Booking-only setup flow

**Files:**
- Create: `src/components/dashboard/booking-only/BookingOnlySetup.jsx`

> Reuses `generateSlug` (`src/lib/publishUtils.js`), creates a `sites` row with `site_type='booking_only'` + `scheduler_enabled=true`, seeds appearance, then publishes the booking shell to the root via `publishBookingPage`.

- [ ] **Step 1: Build the component**

Create `src/components/dashboard/booking-only/BookingOnlySetup.jsx`:
```jsx
import { useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { generateSlug } from '../../../lib/publishUtils.js';
import { defaultSchedulerConfig, defaultAppearance } from '../../../lib/schedulerConfig.js';
import { publishBookingPage } from '../../../lib/publishSite.js';
import ShareBookingCard from './ShareBookingCard.jsx';

const labelBase = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1.5 uppercase tracking-[0.5px]';
const inputBase = 'w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[14px]';
const SWATCHES = ['#1a1a1a', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c'];

export default function BookingOnlySetup({ onDone, onCancel }) {
  const { session } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [accent, setAccent] = useState('#1a1a1a');
  const [tagline, setTagline] = useState('');
  const [pageStyle, setPageStyle] = useState('branded');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { bookingUrl, siteId }

  function onName(v) {
    setBusinessName(v);
    if (!slugDirty) setSlug(generateSlug(v));
  }

  async function create() {
    setError('');
    if (!businessName.trim()) { setError('Enter a business name.'); return; }
    const finalSlug = (slug || generateSlug(businessName)).trim();
    if (!finalSlug) { setError('Enter a valid link slug.'); return; }
    setBusy(true);
    try {
      const appearance = { ...defaultAppearance(), accent_color: accent, tagline, page_style: pageStyle };
      const scheduler_config = { ...defaultSchedulerConfig(), appearance };

      const { data: site, error: insErr } = await supabase
        .from('sites')
        .insert({
          user_id: session.user.id,
          site_type: 'booking_only',
          business_info: { businessName },
          scheduler_enabled: true,
          scheduler_config,
          slug: finalSlug,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      const { bookingUrl } = await publishBookingPage({
        siteId: site.id, businessName, slug: finalSlug, asSubpath: false,
      });
      setResult({ bookingUrl, siteId: site.id });
      onDone && onDone(site.id);
    } catch (e) {
      setError(e.message || 'Could not create your booking page.');
    } finally { setBusy(false); }
  }

  if (result) {
    return (
      <div className="max-w-[560px] mx-auto py-8">
        <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-1">Your booking page is live 🎉</h2>
        <p className="text-[14px] text-[#888] mb-5">Share this link anywhere — Instagram, text, business cards.</p>
        <ShareBookingCard bookingUrl={result.bookingUrl} />
      </div>
    );
  }

  return (
    <div className="max-w-[560px] mx-auto py-8">
      <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-1">Set up your booking page</h2>
      <p className="text-[14px] text-[#888] mb-6">No website needed — just a link people can book from.</p>

      <label className={labelBase}>Business name</label>
      <input className={`${inputBase} mb-4`} value={businessName} onChange={(e) => onName(e.target.value)} placeholder="Joe's Mobile Detailing" />

      <label className={labelBase}>Your link</label>
      <div className="flex items-center border border-black/10 rounded-xl overflow-hidden mb-4">
        <span className="bg-[#f4f3f0] px-2.5 py-2.5 text-[12px] text-[#888] font-mono">book ·</span>
        <input className="flex-1 px-3 py-2.5 text-[13px] font-mono outline-none" value={slug}
          onChange={(e) => { setSlugDirty(true); setSlug(generateSlug(e.target.value)); }} placeholder="joes-detailing" />
      </div>

      <label className={labelBase}>Accent color</label>
      <div className="flex items-center gap-2 mb-4">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => setAccent(c)} style={{ background: c }}
            className={`w-7 h-7 rounded-lg ${accent === c ? 'ring-2 ring-offset-2 ring-[#1a1a1a]' : ''}`} />
        ))}
        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-9 h-9 rounded-lg border border-black/10 p-0.5" />
        <input type="text" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-24 border border-black/10 rounded-xl px-2.5 py-2 text-[13px] font-mono" />
      </div>

      <label className={labelBase}>Page style</label>
      <div className="flex gap-2 mb-4">
        {['minimal', 'branded'].map((v) => (
          <button key={v} type="button" onClick={() => setPageStyle(v)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${pageStyle === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10'}`}>{v}</button>
        ))}
      </div>

      <label className={labelBase}>Tagline (optional)</label>
      <input className={`${inputBase} mb-5`} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Premium car care, at your door" />

      {error && <p className="text-[13px] text-[#dc2626] mb-3">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={create}
          className="rounded-xl px-5 py-2.5 text-[14px] font-semibold bg-[#cc0000] text-white disabled:opacity-60">
          {busy ? 'Creating…' : 'Create booking page'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold border border-black/10">Cancel</button>}
      </div>
      <p className="text-[12px] text-[#888] mt-4">Next: add your services, prices, and availability in Booking Settings.</p>
    </div>
  );
}
```

> RLS note: the existing site-insert policy (`db/migrations/20260505_sites_insert_policy_self_upsert.sql`) must allow inserting a row with `user_id = auth.uid()`. Verify it does; the booking-only insert uses the same shape minus website fields. If the policy requires `site_type='website'` it does not — no website-specific column is referenced — so this should pass. If insert fails with an RLS error during the smoke test, widen the policy in a follow-up migration.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/booking-only/BookingOnlySetup.jsx
git commit -m "feat(booking): booking-only setup flow"
```

---

### Task 10: Onboarding choice + dashboard wiring

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/dashboard/DashboardPage.jsx`

- [ ] **Step 1: Add a `booking-only-setup` view to App.jsx**

In `src/App.jsx`:
1. The `view` state already supports string views. Add a branch (near the other `if (view === ...)` blocks):
```jsx
if (view === 'booking-only-setup') {
  return (
    <BookingOnlySetup
      onDone={() => setView('dashboard')}
      onCancel={() => setView('dashboard')}
    />
  );
}
```
2. Import it at the top: `import BookingOnlySetup from './components/dashboard/booking-only/BookingOnlySetup.jsx';`
3. Pass a new callback to `DashboardPage`: `onNewBookingPage={() => setView('booking-only-setup')}`.

- [ ] **Step 2: Surface the choice + share card in DashboardPage**

In `src/components/dashboard/DashboardPage.jsx`:
1. Add `onNewBookingPage` to the destructured props.
2. Where the "New site" / empty-state CTA is rendered, add a second primary action: a **"Create booking page (no website)"** button that calls `onNewBookingPage()`. Match the existing CTA button classes.
3. For each site card where `site.site_type === 'booking_only'` OR `site.scheduler_enabled`, render `<ShareBookingCard bookingUrl={bookingUrlFor(site)} />`. Add a small local helper:
```jsx
function bookingUrlFor(site) {
  if (!site?.published_url) return '';
  return site.site_type === 'booking_only' ? site.published_url : `${site.published_url}/book`;
}
```
4. Import: `import ShareBookingCard from './booking-only/ShareBookingCard.jsx';`
5. For booking-only site cards, hide website-only actions (Edit template, Business Info) and keep: Booking Settings, Manage Domain, Republish, Delete. Gate with `site.site_type !== 'booking_only'`.

- [ ] **Step 3: Verify build + tests**

Run: `npm run build && npx vitest run`
Expected: build succeeds; all tests pass.

- [ ] **Step 4: Manual smoke test**

Follow `docs/superpowers/smoke-tests/standalone-booking-page.md`, plus:
- From the dashboard, click "Create booking page (no website)" → complete setup → confirm the success screen shows a working link.
- Open the published link → confirm full-page booking renders with the chosen style/accent.
- Confirm the dashboard card shows the share link + QR.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/dashboard/DashboardPage.jsx
git commit -m "feat(booking): onboarding choice + dashboard share card wiring"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** booking-only data model (Task 1), appearance/theming incl. hex picker (Tasks 2,3,7,9), full-page standalone render with Minimal/Branded styles (Task 4), reuse of publish/subdomain/custom-domain pipeline (Tasks 5,6), `/book` path for website users (Task 6), setup flow + slug (Task 9), onboarding choice + share link + QR (Tasks 8,10). Custom domains need no new work — booking-only sites flow through the existing `connect-domain` machinery unchanged.
- **Open items (from spec) confirmed here:** `/book` path retained; appearance changes apply live (no republish) because the shell fetches config at runtime.
- **Deferred to Features 2 & 3:** per-vehicle options and recurring bookings are separate plans.
- **Risk flags for the executor:** (a) verify `openModal(..., {inline:true})` mounts into `#acg-scheduler-preview-host` (Task 4 Step 3 note); (b) verify the sites-insert RLS policy permits booking-only rows (Task 9 note); (c) the `/book` subpath publish must not overwrite an existing homepage (Task 6 Step 2 note).
