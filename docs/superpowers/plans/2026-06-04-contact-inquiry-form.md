# Contact / Inquiry Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a general contact/inquiry form to every published site (separate from bookings) whose submissions are stored in a new `inquiries` table and viewed in a new **Inquiries** dashboard tab. No emails are sent.

**Architecture:** Mirror the existing booking pipeline. A self-contained `public/contact-form.js` widget is injected into each published site's `#contact` section (exactly like `scheduler.js`). It POSTs to an anonymous `create-inquiry` Netlify function guarded by wide-open CORS + Postgres rate limit + honeypot + validation, which inserts via the Supabase service role into an `inquiries` table protected by RLS. Owners read/manage submissions through new dashboard components that reuse the bookings list/drawer patterns. The feature is **free for all sites** — no subscription/scheduler gating.

**Tech Stack:** React 19 + Vite, Tailwind (utility classes in dashboard), vanilla JS widget (inline styles for isolation), Netlify Functions (Node ESM), Supabase Postgres + RLS, Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-04-contact-inquiry-form-design.md`

---

## File Structure

**Create:**
- `db/migrations/20260604_inquiries.sql` — table, indexes, RLS, `can_inquire_site()`, grants.
- `netlify/functions/_lib/inquiry-validation.js` — pure payload validator.
- `tests/functions/inquiry-validation.test.js` — unit tests for the validator.
- `netlify/functions/create-inquiry.js` — anonymous POST handler.
- `public/contact-form.js` — site widget injected into `#contact`.
- `src/lib/inquiries.js` — dashboard data layer (list/update/notes).
- `src/components/dashboard/inquiries/InquiryStatusPill.jsx`
- `src/components/dashboard/inquiries/InquiriesList.jsx`
- `src/components/dashboard/inquiries/InquiryDetailDrawer.jsx`
- `src/components/dashboard/inquiries/InquiriesView.jsx`
- `src/components/dashboard/inquiries-page/InquiriesPage.jsx`

**Modify:**
- `src/lib/exportHtml.js` — inject the `contact-form.js` script tag.
- `src/components/ui/AppHeader.jsx` — add the **Inquiries** nav item.
- `src/App.jsx` — add the `view === 'inquiries'` branch + thread `onOpenInquiries`.
- `src/components/dashboard/DashboardPage.jsx`
- `src/components/dashboard/bookings-page/BookingsPage.jsx`
- `src/components/dashboard/customers-page/CustomersPage.jsx`
- `src/components/dashboard/customers-page/CustomerDetailPage.jsx`
- `src/components/dashboard/charges/ChargesPage.jsx`
- `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx`
- `src/components/dashboard/booking-settings/BookingSettingsPage.jsx`

---

## Task 1: Database migration — `inquiries` table + RLS

**Files:**
- Create: `db/migrations/20260604_inquiries.sql`

This mirrors `db/migrations/20260422_scheduler_mvp.sql` (the `bookings` table + RLS), minus booking-specific columns. The key difference: `can_inquire_site()` only checks the site exists — NO `scheduler_enabled`/subscription check, because inquiries are free for all sites.

- [ ] **Step 1: Write the migration file**

```sql
-- Inquiries (general contact form) — table + RLS.
-- Mirrors the bookings table but free-for-all: any existing site can receive
-- inquiries (no scheduler_enabled / subscription gate). Inserts happen via the
-- create-inquiry function using the service role; the anon INSERT policy below
-- is defense-in-depth. Apply via Supabase SQL editor as the postgres role.

begin;

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','archived')),
  owner_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_owner_status_created_idx
  on inquiries (owner_user_id, status, created_at desc);
create index if not exists inquiries_site_created_idx
  on inquiries (site_id, created_at desc);

-- Helper: can the anon role create an inquiry for this site?
-- Only requires the site to exist (no scheduler/subscription gate).
create or replace function public.can_inquire_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sites s where s.id = p_site_id);
$$;

alter table inquiries enable row level security;

-- Keep updated_at in sync on UPDATE (reuses tg_set_updated_at from the
-- scheduler MVP migration).
drop trigger if exists set_updated_at_inquiries on inquiries;
create trigger set_updated_at_inquiries
  before update on inquiries
  for each row execute function public.tg_set_updated_at();

-- Anonymous visitors can INSERT only, when the site exists.
create policy "inquiries_insert_anon_when_site_exists" on inquiries
  for insert to anon
  with check (public.can_inquire_site(site_id));

-- Owners (and super admins) can read / update their inquiries.
create policy "inquiries_select_owner_or_admin" on inquiries
  for select using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

create policy "inquiries_update_owner_or_admin" on inquiries
  for update using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

grant execute on function public.can_inquire_site(uuid) to anon, authenticated;
grant insert on table inquiries to anon;
grant select, update on table inquiries to authenticated;

commit;
```

- [ ] **Step 2: Apply the migration to Supabase**

Apply the SQL using the Supabase MCP `apply_migration` tool (name: `inquiries`, the SQL above) OR paste it into the Supabase SQL editor and run it as the postgres role.

- [ ] **Step 3: Verify the table exists**

Use the Supabase MCP `list_tables` tool (schema `public`) and confirm an `inquiries` table is present with columns `id, site_id, owner_user_id, name, email, phone, message, status, owner_notes, created_at, updated_at`.
Expected: table present; `status` has a CHECK constraint of `('new','read','archived')`.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/20260604_inquiries.sql
git commit -m "feat(inquiries): add inquiries table + RLS migration"
```

---

## Task 2: Inquiry payload validator (TDD)

**Files:**
- Test: `tests/functions/inquiry-validation.test.js`
- Create: `netlify/functions/_lib/inquiry-validation.js`

Mirrors `_lib/booking-validation.js`: returns `{ ok: true }`, `{ ok: false, error }`, or `{ ok: false, honeypot: true }`. Fields: `siteId` (UUID), `name` (required, ≤200), `email` (required, regex), `phone` (optional, ≤40), `message` (required, ≤5000). Honeypot field is `website`.

- [ ] **Step 1: Write the failing test**

Create `tests/functions/inquiry-validation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateInquiryPayload } from '../../netlify/functions/_lib/inquiry-validation.js';

const base = {
  siteId: '00000000-0000-0000-0000-000000000001',
  name: 'Alex',
  email: 'a@x.com',
  phone: '555-1234',
  message: 'Do you offer mobile service?',
};

describe('validateInquiryPayload', () => {
  it('accepts a fully valid payload', () => {
    expect(validateInquiryPayload(base).ok).toBe(true);
  });

  it('accepts a payload with no phone (phone optional)', () => {
    const { phone, ...rest } = base;
    expect(validateInquiryPayload(rest).ok).toBe(true);
  });

  it('rejects a non-object payload', () => {
    expect(validateInquiryPayload(null).ok).toBe(false);
  });

  it('rejects missing name', () => {
    const { name, ...rest } = base;
    const r = validateInquiryPayload(rest);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/name/);
  });

  it('rejects missing message', () => {
    const { message, ...rest } = base;
    const r = validateInquiryPayload(rest);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/message/);
  });

  it('rejects invalid email', () => {
    const r = validateInquiryPayload({ ...base, email: 'not-email' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/email/i);
  });

  it('rejects non-uuid siteId', () => {
    const r = validateInquiryPayload({ ...base, siteId: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/siteId/);
  });

  it('rejects an over-length message', () => {
    const r = validateInquiryPayload({ ...base, message: 'x'.repeat(5001) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/message/);
  });

  it('rejects an over-length name', () => {
    const r = validateInquiryPayload({ ...base, name: 'x'.repeat(201) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/name/);
  });

  it('treats a non-empty honeypot as invalid (silent reject)', () => {
    const r = validateInquiryPayload({ ...base, website: 'http://spam.com' });
    expect(r.ok).toBe(false);
    expect(r.honeypot).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/functions/inquiry-validation.test.js`
Expected: FAIL — cannot resolve `inquiry-validation.js` (module not found).

- [ ] **Step 3: Write the validator**

Create `netlify/functions/_lib/inquiry-validation.js`:

```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME = 200;
const MAX_PHONE = 40;
const MAX_MESSAGE = 5000;

export function validateInquiryPayload(p) {
  if (!p || typeof p !== 'object') return fail('Payload must be an object');

  // Honeypot — if filled, reject silently (caller should 200 and drop).
  if (typeof p.website === 'string' && p.website.trim() !== '') {
    return { ok: false, honeypot: true, error: 'honeypot' };
  }

  if (!p.siteId || !UUID_RE.test(p.siteId)) return fail('Invalid siteId');

  if (!isNonEmptyString(p.name)) return fail('Missing required field: name');
  if (p.name.length > MAX_NAME) return fail('name too long');

  if (!isNonEmptyString(p.email)) return fail('Missing required field: email');
  if (!EMAIL_RE.test(p.email)) return fail('Invalid email');

  if (!isNonEmptyString(p.message)) return fail('Missing required field: message');
  if (p.message.length > MAX_MESSAGE) return fail('message too long');

  if (p.phone != null && p.phone !== '') {
    if (typeof p.phone !== 'string' || p.phone.length > MAX_PHONE) {
      return fail('Invalid phone');
    }
  }

  return { ok: true };
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function fail(error) { return { ok: false, error }; }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/functions/inquiry-validation.test.js`
Expected: PASS — 10 passing.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/inquiry-validation.js tests/functions/inquiry-validation.test.js
git commit -m "feat(inquiries): add inquiry payload validator with tests"
```

---

## Task 3: `create-inquiry` Netlify function

**Files:**
- Create: `netlify/functions/create-inquiry.js`

Mirrors `netlify/functions/create-booking.js` structure (wide-open CORS, rate limit, honeypot, validation, service-role insert) but with NO subscription/scheduler gate and NO Postmark/email call. Handler DB behavior is verified manually (Task 9), consistent with the repo (booking handlers are not unit-tested; only their libs are).

- [ ] **Step 1: Write the function**

Create `netlify/functions/create-inquiry.js`:

```js
import { createClient } from '@supabase/supabase-js';
import { validateInquiryPayload } from './_lib/inquiry-validation.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { PUBLIC_CORS, PUBLIC_CORS_JSON } from './_shared/cors.js';

// Public widget endpoint — called from contact-form.js injected on every
// customer's published site. Wide-open CORS by design (each customer has
// their own domain). Rate limit + honeypot + validation are the guards.
// Free for all sites: no subscription/scheduler gate, and no email is sent.
const CORS = PUBLIC_CORS_JSON;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: PUBLIC_CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const v = validateInquiryPayload(payload);
  if (v.honeypot) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  if (!v.ok) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: v.error }) };

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Postgres-backed rate limit: 5 inquiries per IP+site per hour. Fail-open.
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const { limited } = await checkAndRecordRateLimit({
    db: supabase,
    ip,
    kind: `create-inquiry:${payload.siteId}`,
    windowMs: 60 * 60 * 1000,
    limit: 5,
  });
  if (limited) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id')
    .eq('id', payload.siteId)
    .maybeSingle();
  if (!site) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Site not found' }) };
  }

  const { error: insErr } = await supabase
    .from('inquiries')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      message: payload.message,
    });

  if (insErr) {
    console.error('create-inquiry insert error:', insErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to submit inquiry' }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
```

- [ ] **Step 2: Verify it lints**

Run: `npx eslint netlify/functions/create-inquiry.js` (if eslint is configured for that path) — otherwise `node --check netlify/functions/create-inquiry.js`.
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/create-inquiry.js
git commit -m "feat(inquiries): add anonymous create-inquiry function"
```

---

## Task 4: `contact-form.js` site widget

**Files:**
- Create: `public/contact-form.js`

Self-contained vanilla-JS widget mirroring `public/scheduler.js` idioms: reads its own `<script>` tag, derives the API base from `script.src`, finds the `#contact` section (fallback: insert before the last `<footer>`), injects a styled form, and POSTs to `create-inquiry`. Inline styles only (DOM isolation). Verified manually in Task 9.

- [ ] **Step 1: Write the widget**

Create `public/contact-form.js`:

```js
/* Contact / inquiry form widget — injects a general inquiry form into the
   site's #contact section. Free for all sites; posts to create-inquiry. */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var siteId = script && script.getAttribute('data-site-id');
  var accent = (script && script.getAttribute('data-accent')) || '#1a1a1a';
  if (!siteId) return;

  var API = script.src.replace(/\/contact-form\.js.*$/, '');

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  ready(function () {
    if (document.querySelector('[data-acg-inquiry]')) return; // guard double-inject

    var host = document.querySelector('#contact');
    if (!host) {
      // Fallback: insert a new section before the last footer (or at body end).
      host = document.createElement('section');
      var footers = document.querySelectorAll('footer');
      if (footers.length) {
        footers[footers.length - 1].parentNode.insertBefore(host, footers[footers.length - 1]);
      } else {
        document.body.appendChild(host);
      }
    }

    var wrap = document.createElement('div');
    wrap.setAttribute('data-acg-inquiry', '');
    wrap.style.cssText = 'max-width:520px;margin:32px auto 0;padding:0 16px;font-family:inherit;';
    wrap.innerHTML = formHtml(accent);
    host.appendChild(wrap);

    var form = wrap.querySelector('form');
    var status = wrap.querySelector('[data-acg-status]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      // Use form.elements[...] — NOT form.name, which resolves to the form's
      // own `name` IDL attribute instead of the input named "name".
      var name = form.elements['name'].value.trim();
      var email = form.elements['email'].value.trim();
      var phone = form.elements['phone'].value.trim();
      var message = form.elements['message'].value.trim();
      var website = form.elements['website'].value; // honeypot

      if (!name || !email || !message) {
        status.style.color = '#cc0000';
        status.textContent = 'Please fill in your name, email, and message.';
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      var prevLabel = btn.textContent;
      btn.textContent = 'Sending…';

      fetch(API + '/.netlify/functions/create-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, name: name, email: email, phone: phone, message: message, website: website }),
      })
        .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
        .then(function (res) {
          if (res.ok && res.b && res.b.ok) {
            wrap.innerHTML = successHtml(accent);
          } else {
            btn.disabled = false;
            btn.textContent = prevLabel;
            status.style.color = '#cc0000';
            status.textContent = (res.b && res.b.error) ? res.b.error : 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = prevLabel;
          status.style.color = '#cc0000';
          status.textContent = 'Network error. Please try again.';
        });
    });
  });

  function fieldCss() {
    return 'width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:12px;border:1px solid rgba(0,0,0,0.15);border-radius:10px;font-size:15px;font-family:inherit;background:#fff;color:#1a1a1a;';
  }

  function formHtml(accent) {
    return ''
      + '<h3 style="font-size:1.4rem;font-weight:700;margin:0 0 16px;color:inherit;">Send us a message</h3>'
      + '<form novalidate>'
      + '<input name="name" type="text" placeholder="Your name" autocomplete="name" style="' + fieldCss() + '" />'
      + '<input name="email" type="email" placeholder="Email address" autocomplete="email" style="' + fieldCss() + '" />'
      + '<input name="phone" type="tel" placeholder="Phone (optional)" autocomplete="tel" style="' + fieldCss() + '" />'
      + '<textarea name="message" rows="4" placeholder="How can we help?" style="' + fieldCss() + 'resize:vertical;"></textarea>'
      + '<input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" />'
      + '<button type="submit" style="width:100%;padding:13px 16px;border:0;border-radius:10px;background:' + accent + ';color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Send message</button>'
      + '<p data-acg-status role="status" style="margin:10px 0 0;font-size:13px;min-height:16px;"></p>'
      + '</form>';
  }

  function successHtml(accent) {
    return ''
      + '<div style="text-align:center;padding:28px 16px;border:1px solid rgba(0,0,0,0.1);border-radius:12px;background:#fff;">'
      + '<div style="width:44px;height:44px;border-radius:50%;background:' + accent + ';color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:22px;">✓</div>'
      + '<h3 style="margin:0 0 6px;font-size:1.2rem;font-weight:700;color:#1a1a1a;">Thanks — we\'ll be in touch.</h3>'
      + '<p style="margin:0;color:#666;font-size:14px;">Your message has been sent.</p>'
      + '</div>';
  }
})();
```

- [ ] **Step 2: Syntax-check the widget**

Run: `node --check public/contact-form.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add public/contact-form.js
git commit -m "feat(inquiries): add contact-form.js site widget"
```

---

## Task 5: Inject the widget at export time

**Files:**
- Modify: `src/lib/exportHtml.js`

Add a `CONTACT_WIDGET_URL` constant beside `SCHEDULER_WIDGET_URL`, then emit a `<script>` tag for it next to the scheduler tag in `buildSeoHead`. The accent reuses the same resolution as the favicon (`templateMeta?.colors?.primary || templateMeta?.colors?.accent || '#cc0000'`).

- [ ] **Step 1: Add the CONTACT_WIDGET_URL constant**

In `src/lib/exportHtml.js`, immediately after the `SCHEDULER_WIDGET_URL` definition (ends at line 10), add:

```js
const CONTACT_WIDGET_URL =
  (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://app.autocaregenius.com') + '/contact-form.js';
```

- [ ] **Step 2: Inject the contact-form script tag**

In `buildSeoHead`, find the scheduler script line (currently line 111-112):

```js
  <!-- Scheduler widget (visible only if owner has scheduler enabled) -->
  ${siteId ? `<script src="${SCHEDULER_WIDGET_URL}" data-site-id="${siteId}" defer></script>` : ''}
```

Replace it with (adds the contact-form tag right after, resolving the accent inline):

```js
  <!-- Scheduler widget (visible only if owner has scheduler enabled) -->
  ${siteId ? `<script src="${SCHEDULER_WIDGET_URL}" data-site-id="${siteId}" defer></script>` : ''}

  <!-- Contact / inquiry form widget (free for all published sites) -->
  ${siteId ? `<script src="${CONTACT_WIDGET_URL}" data-site-id="${siteId}" data-accent="${escapeAttr(templateMeta?.colors?.primary || templateMeta?.colors?.accent || '#cc0000')}" defer></script>` : ''}
```

(`escapeAttr` is already defined at exportHtml.js:45 and is in scope inside `buildSeoHead`.)

- [ ] **Step 3: Verify the build still compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/exportHtml.js
git commit -m "feat(inquiries): inject contact-form widget into exported sites"
```

---

## Task 6: Dashboard data layer — `src/lib/inquiries.js`

**Files:**
- Create: `src/lib/inquiries.js`

Mirrors `src/lib/bookings.js` (which is itself untested in this repo — uses the live Supabase client). Provides owner + admin listing, status update, and notes save.

- [ ] **Step 1: Write the data layer**

Create `src/lib/inquiries.js`:

```js
import { supabase } from './supabase.js';

export async function listInquiriesForOwner({ userId, statusIn, search }) {
  let q = supabase
    .from('inquiries')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });

  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listAllInquiries({ statusIn, search, ownerUserId } = {}) {
  let q = supabase.from('inquiries').select('*').order('created_at', { ascending: false });
  if (ownerUserId) q = q.eq('owner_user_id', ownerUserId);
  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateInquiryStatus(id, status) {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveInquiryOwnerNotes(id, owner_notes) {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ owner_notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Verify it lints**

Run: `npx eslint src/lib/inquiries.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inquiries.js
git commit -m "feat(inquiries): add dashboard data layer for inquiries"
```

---

## Task 7: Inquiry status pill

**Files:**
- Create: `src/components/dashboard/inquiries/InquiryStatusPill.jsx`

Mirrors `src/components/dashboard/bookings/StatusPill.jsx` with the three inquiry statuses.

- [ ] **Step 1: Write the pill**

Create `src/components/dashboard/inquiries/InquiryStatusPill.jsx`:

```jsx
const STYLES = {
  new:      { bg: 'bg-amber-50', fg: 'text-amber-700', border: 'border-amber-200', label: 'New' },
  read:     { bg: 'bg-blue-50',  fg: 'text-blue-700',  border: 'border-blue-200',  label: 'Read' },
  archived: { bg: 'bg-gray-100', fg: 'text-gray-500',  border: 'border-gray-200',  label: 'Archived' },
};

export default function InquiryStatusPill({ status, className = '' }) {
  const s = STYLES[status] || STYLES.new;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.fg} ${s.border} ${className}`}
    >
      {s.label}
    </span>
  );
}
```

- [ ] **Step 2: Verify it lints**

Run: `npx eslint src/components/dashboard/inquiries/InquiryStatusPill.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/inquiries/InquiryStatusPill.jsx
git commit -m "feat(inquiries): add inquiry status pill"
```

---

## Task 8: Inquiries list (with filter chips + search)

**Files:**
- Create: `src/components/dashboard/inquiries/InquiriesList.jsx`

Mirrors `BookingsList.jsx` but inlines simple filter chips (New / Read / Archived / All) and a search box — no separate filters file. Default filter shows `new` + `read` (hides archived), matching how bookings defaults to active statuses. Shows an unread count.

- [ ] **Step 1: Write the list**

Create `src/components/dashboard/inquiries/InquiriesList.jsx`:

```jsx
import { useMemo, useState } from 'react';
import InquiryStatusPill from './InquiryStatusPill.jsx';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const FILTERS = [
  { key: 'active',   label: 'Inbox',    statuses: ['new', 'read'] },
  { key: 'new',      label: 'New',      statuses: ['new'] },
  { key: 'read',     label: 'Read',     statuses: ['read'] },
  { key: 'archived', label: 'Archived', statuses: ['archived'] },
  { key: 'all',      label: 'All',      statuses: ['new', 'read', 'archived'] },
];

export default function InquiriesList({ inquiries, onSelect }) {
  const [filterKey, setFilterKey] = useState('active');
  const [search, setSearch] = useState('');

  const unreadCount = useMemo(
    () => inquiries.filter((i) => i.status === 'new').length,
    [inquiries]
  );

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filterKey) || FILTERS[0];
    const q = search.trim().toLowerCase();
    return inquiries
      .filter((i) => f.statuses.includes(i.status))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q));
  }, [inquiries, filterKey, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => {
          const active = f.key === filterKey;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                active
                  ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                  : 'bg-white text-[#1a1a1a] border-black/[0.1] hover:bg-black/[0.04]'
              }`}
            >
              {f.label}
              {f.key === 'new' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          );
        })}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="ml-auto border border-black/[0.1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-black/[0.07] rounded-2xl bg-white text-gray-500 text-sm">
          No inquiries match these filters.
        </div>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => onSelect(i)}
                  className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${i.status === 'new' ? 'font-medium' : ''}`}
                >
                  <td className="px-4 py-3"><InquiryStatusPill status={i.status} /></td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{i.name}</div>
                    <div className="text-xs text-gray-500">{i.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[280px] truncate">{i.message}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it lints**

Run: `npx eslint src/components/dashboard/inquiries/InquiriesList.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/inquiries/InquiriesList.jsx
git commit -m "feat(inquiries): add inquiries list with filters and search"
```

---

## Task 9: Inquiry detail drawer (read/unread, archive, notes, impersonation read-only)

**Files:**
- Create: `src/components/dashboard/inquiries/InquiryDetailDrawer.jsx`

Mirrors `BookingDetailDrawer.jsx`. Actions depend on status: `new` → [Mark read] [Archive]; `read` → [Mark unread] [Archive]; `archived` → [Restore]. Owner notes save on blur. While impersonating (`isImpersonationTab`), action buttons are hidden and the notes textarea is read-only — matching the read-only impersonation guard used in `DashboardPage.jsx`.

- [ ] **Step 1: Write the drawer**

Create `src/components/dashboard/inquiries/InquiryDetailDrawer.jsx`:

```jsx
import { useState, useEffect } from 'react';
import InquiryStatusPill from './InquiryStatusPill.jsx';
import { isImpersonationTab } from '../../../lib/supabase.js';
import { updateInquiryStatus, saveInquiryOwnerNotes } from '../../../lib/inquiries.js';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const ACTIONS_FOR = {
  new:      [{ to: 'read',     label: 'Mark read',   primary: true },
             { to: 'archived', label: 'Archive',     primary: false }],
  read:     [{ to: 'new',      label: 'Mark unread', primary: true },
             { to: 'archived', label: 'Archive',     primary: false }],
  archived: [{ to: 'read',     label: 'Restore',     primary: true }],
};

export default function InquiryDetailDrawer({ inquiry, onClose, onUpdated }) {
  const [i, setI] = useState(inquiry);
  const [notes, setNotes] = useState(inquiry?.owner_notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { setI(inquiry); setNotes(inquiry?.owner_notes || ''); setErr(null); }, [inquiry?.id]);

  if (!i) return null;

  async function setStatus(to) {
    setBusy(true); setErr(null);
    try {
      const updated = await updateInquiryStatus(i.id, to);
      setI(updated);
      onUpdated && onUpdated(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function onNotesBlur() {
    if (notes === (i.owner_notes || '')) return;
    try {
      const updated = await saveInquiryOwnerNotes(i.id, notes);
      setI(updated);
      onUpdated && onUpdated(updated);
    } catch (e) { setErr(e.message); }
  }

  const actions = ACTIONS_FOR[i.status] || [];

  return (
    <div className="fixed inset-0 z-[60] flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/[0.04] hover:bg-[#cc0000]/10 hover:text-[#cc0000] text-[#555] flex items-center justify-center transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="mb-4 pr-10">
          <InquiryStatusPill status={i.status} />
        </div>

        <h2 className="text-xl font-black text-[#1a1a1a]">{i.name}</h2>
        <p className="text-sm text-gray-500 mb-4">
          <a href={`mailto:${i.email}`} className="hover:underline">{i.email}</a>
          {i.phone ? (<>{' · '}<a href={`tel:${i.phone}`} className="hover:underline">{i.phone}</a></>) : null}
        </p>

        <dl className="text-sm space-y-2 mb-6">
          <div className="flex gap-2">
            <dt className="w-20 text-gray-500 shrink-0">Message</dt>
            <dd className="text-gray-800 break-words whitespace-pre-wrap">{i.message}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-gray-500 shrink-0">Received</dt>
            <dd className="text-gray-800">{fmt(i.created_at)}</dd>
          </div>
        </dl>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Owner notes (private)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onNotesBlur}
          rows={3}
          readOnly={isImpersonationTab}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400 disabled:opacity-60"
        />

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        {!isImpersonationTab && actions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.to}
                onClick={() => setStatus(a.to)}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                  a.primary
                    ? 'bg-[#cc0000] hover:bg-[#aa0000] text-white'
                    : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Verify it lints**

Run: `npx eslint src/components/dashboard/inquiries/InquiryDetailDrawer.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/inquiries/InquiryDetailDrawer.jsx
git commit -m "feat(inquiries): add inquiry detail drawer with status + notes"
```

---

## Task 10: Inquiries view (data fetch + selection)

**Files:**
- Create: `src/components/dashboard/inquiries/InquiriesView.jsx`

Mirrors `BookingsView.jsx` minus the calendar: fetches via `inquiries.js` (admin vs owner), holds selected state, renders list + drawer.

- [ ] **Step 1: Write the view**

Create `src/components/dashboard/inquiries/InquiriesView.jsx`:

```jsx
import { useEffect, useState } from 'react';
import InquiriesList from './InquiriesList.jsx';
import InquiryDetailDrawer from './InquiryDetailDrawer.jsx';
import { listInquiriesForOwner, listAllInquiries } from '../../../lib/inquiries.js';

export default function InquiriesView({ userId, isAdmin = false }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const rows = isAdmin
        ? await listAllInquiries({})
        : await listInquiriesForOwner({ userId });
      setInquiries(rows);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [userId, isAdmin]);

  function onUpdated(updated) {
    setInquiries((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    setSelected(updated);
  }

  return (
    <div>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        <InquiriesList inquiries={inquiries} onSelect={setSelected} />
      )}

      {selected && (
        <InquiryDetailDrawer
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it lints**

Run: `npx eslint src/components/dashboard/inquiries/InquiriesView.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/inquiries/InquiriesView.jsx
git commit -m "feat(inquiries): add inquiries view"
```

---

## Task 11: Inquiries page (shell + header)

**Files:**
- Create: `src/components/dashboard/inquiries-page/InquiriesPage.jsx`

Mirrors `BookingsPage.jsx` shell (loading/error/empty states keep `AppHeader` mounted) but with NO `SubscribeGate` (free for all) and NO settings tab. Loads the user's sites only to derive admin context and the empty-state copy. `active: 'inquiries'`.

- [ ] **Step 1: Write the page**

Create `src/components/dashboard/inquiries-page/InquiriesPage.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import AppHeader from '../../ui/AppHeader.jsx';
import InquiriesView from '../inquiries/InquiriesView.jsx';

export default function InquiriesPage({
  userId, profile, userEmail, onExit,
  onOpenBookings, onOpenCustomers, onOpenAdmin, onOpenProfile,
  onOpenPaymentsConnect, onOpenCharges, onCharge, onSignOut,
}) {
  const headerProps = {
    active: 'inquiries',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenInquiries: () => {},
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onOpenCharges,
    onCharge,
    onSignOut,
  };

  const isAdmin = !!profile?.is_super_admin;
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    async function fetchSites() {
      const { data, error } = await supabase
        .from('sites')
        .select('id, business_info, published_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) { setErr(error.message); setLoading(false); return; }
      setSites(data || []);
      setLoading(false);
    }
    if (userId) fetchSites();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-7xl mx-auto px-3 py-10"><p className="text-[#888] text-sm">Loading...</p></main>
      </div>
    );
  }
  if (err) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-7xl mx-auto px-3 py-10">
          <div className="border border-[#cc0000]/20 rounded-xl p-4 text-sm text-[#cc0000] bg-[#cc0000]/5">{err}</div>
        </main>
      </div>
    );
  }
  if (!isAdmin && sites.length === 0) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-3 py-10">
          <p className="text-gray-600">Create and publish a site first — your contact form lives on your published site.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <main className="max-w-7xl mx-auto px-3 py-10">
        <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mb-3 mt-8">Inquiries</h1>
        <p className="text-sm text-gray-500 mb-6">Messages people sent through your site's contact form.</p>
        <InquiriesView userId={userId} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify it lints**

Run: `npx eslint src/components/dashboard/inquiries-page/InquiriesPage.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/inquiries-page/InquiriesPage.jsx
git commit -m "feat(inquiries): add inquiries dashboard page"
```

---

## Task 12: Add the Inquiries nav item to AppHeader

**Files:**
- Modify: `src/components/ui/AppHeader.jsx`

Add `onOpenInquiries` to the props and a nav item shown to ALL users (not gated by `showBookingsNav`), placed right after Dashboard.

- [ ] **Step 1: Update the JSDoc active union (line 11)**

Change:

```jsx
  active,                  // 'sites' | 'bookings' | 'customers' | 'charges' | 'payments-connect' | 'admin' | 'profile'
```

to:

```jsx
  active,                  // 'sites' | 'inquiries' | 'bookings' | 'customers' | 'charges' | 'payments-connect' | 'admin' | 'profile'
```

- [ ] **Step 2: Add the prop to the destructured params**

In the `AppHeader({ ... })` parameter list, add `onOpenInquiries,` immediately after `onMySites,` (line 14):

```jsx
  onMySites,
  onOpenInquiries,
  onOpenBookings,
```

- [ ] **Step 3: Add the nav item**

In the `navItems` array (lines 32-39), add the Inquiries entry right after the `sites` entry:

```jsx
  const navItems = [
    onMySites && { id: 'sites', label: 'Dashboard', onClick: onMySites },
    onOpenInquiries && { id: 'inquiries', label: 'Inquiries', onClick: onOpenInquiries },
    showBookingsNav && onOpenBookings && { id: 'bookings', label: 'Bookings', onClick: onOpenBookings },
    showBookingsNav && onOpenCustomers && { id: 'customers', label: 'Customers', onClick: onOpenCustomers },
    showBookingsNav && onOpenCharges && { id: 'charges', label: 'Charges', onClick: onOpenCharges },
    onOpenPaymentsConnect && { id: 'payments-connect', label: 'Payments', onClick: onOpenPaymentsConnect },
    isAdmin && onOpenAdmin && { id: 'admin', label: 'Admin', onClick: onOpenAdmin },
  ].filter(Boolean);
```

- [ ] **Step 4: Verify it lints**

Run: `npx eslint src/components/ui/AppHeader.jsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/AppHeader.jsx
git commit -m "feat(inquiries): add Inquiries nav item to AppHeader"
```

---

## Task 13: Wire the `inquiries` view into App.jsx

**Files:**
- Modify: `src/App.jsx`

Add the import, the `view === 'inquiries'` render branch, and thread `onOpenInquiries={() => setView('inquiries')}` into every page that renders `AppHeader`.

- [ ] **Step 1: Import InquiriesPage**

After the `BookingsPage` import (App.jsx:18), add:

```jsx
import InquiriesPage from './components/dashboard/inquiries-page/InquiriesPage.jsx';
```

- [ ] **Step 2: Add the `inquiries` render branch**

Immediately before the `if (view === 'bookings-page') {` block (App.jsx:404), add:

```jsx
  if (view === 'inquiries') {
    return (
      <>
        <InquiriesPage
          userId={session?.user?.id}
          profile={profile}
          userEmail={session?.user?.email}
          onExit={() => setView('dashboard')}
          onOpenBookings={() => setView('bookings-page')}
          onOpenCustomers={() => setView('customers')}
          onOpenAdmin={() => setView('admin')}
          onOpenProfile={() => setView('profile')}
          onOpenPaymentsConnect={onOpenPaymentsConnectProp}
          onOpenCharges={onOpenChargesProp}
          onCharge={onChargeProp}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }
```

- [ ] **Step 3: Thread `onOpenInquiries` into each page render site**

In `src/App.jsx`, add `onOpenInquiries={() => setView('inquiries')}` as a prop alongside the existing `onMySites`/`onExit` prop in EACH of these page renders (search for the component tag, add the line within its prop list):

- `<BookingsPage ...>` (around App.jsx:407)
- `<CustomersPage ...>` (around App.jsx:428)
- `<CustomerDetailPage ...>` (around App.jsx:450) — use `onOpenInquiries={() => { setSelectedCustomerKey(null); setView('inquiries'); }}` to match its sibling handlers that clear `selectedCustomerKey`
- `<ChargesPage ...>`
- `<PaymentsConnectPage ...>`
- `<BookingSettingsPage ...>` — use `onOpenInquiries={() => { setSettingsSiteId(null); setView('inquiries'); }}` to match its sibling handlers that clear `settingsSiteId`
- `<DashboardPage ...>` (around App.jsx:574)

For the standard pages the exact line to add is:

```jsx
          onOpenInquiries={() => setView('inquiries')}
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(inquiries): route the inquiries view and thread nav callback"
```

---

## Task 14: Thread `onOpenInquiries` through the page components into AppHeader

**Files:**
- Modify: `src/components/dashboard/DashboardPage.jsx`
- Modify: `src/components/dashboard/bookings-page/BookingsPage.jsx`
- Modify: `src/components/dashboard/customers-page/CustomersPage.jsx`
- Modify: `src/components/dashboard/customers-page/CustomerDetailPage.jsx`
- Modify: `src/components/dashboard/charges/ChargesPage.jsx`
- Modify: `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx`
- Modify: `src/components/dashboard/booking-settings/BookingSettingsPage.jsx`

Each page must (a) accept `onOpenInquiries` as a prop and (b) pass it to its `AppHeader`. Without this, the Inquiries tab won't render on that page.

- [ ] **Step 1: BookingsPage — accept + pass the prop**

In `src/components/dashboard/bookings-page/BookingsPage.jsx`:
- Add `onOpenInquiries` to the function params (after `onOpenCustomers,` in the destructure on line 8).
- In the `headerProps` object (lines 9-22), add `onOpenInquiries,` after `onMySites: onExit,`.

- [ ] **Step 2: DashboardPage — accept + pass the prop**

In `src/components/dashboard/DashboardPage.jsx`:
- Add `onOpenInquiries` to the component's destructured props.
- Find where it renders `<AppHeader ... />` and add `onOpenInquiries={onOpenInquiries}` to that element's props.

- [ ] **Step 3: CustomersPage — accept + pass the prop**

In `src/components/dashboard/customers-page/CustomersPage.jsx`:
- Add `onOpenInquiries` to the destructured props.
- Add `onOpenInquiries={onOpenInquiries}` (or include it in the page's `headerProps` object if it uses one) on its `<AppHeader />`.

- [ ] **Step 4: CustomerDetailPage — accept + pass the prop**

In `src/components/dashboard/customers-page/CustomerDetailPage.jsx`:
- Add `onOpenInquiries` to the destructured props.
- Add `onOpenInquiries={onOpenInquiries}` on its `<AppHeader />`.

- [ ] **Step 5: ChargesPage — accept + pass the prop**

In `src/components/dashboard/charges/ChargesPage.jsx`:
- Add `onOpenInquiries` to the destructured props.
- Add `onOpenInquiries={onOpenInquiries}` on its `<AppHeader />`.

- [ ] **Step 6: PaymentsConnectPage — accept + pass the prop**

In `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx`:
- Add `onOpenInquiries` to the destructured props.
- Add `onOpenInquiries={onOpenInquiries}` on its `<AppHeader />`.

- [ ] **Step 7: BookingSettingsPage — accept + pass the prop**

In `src/components/dashboard/booking-settings/BookingSettingsPage.jsx`:
- Add `onOpenInquiries` to the destructured props.
- Add `onOpenInquiries={onOpenInquiries}` on its `<AppHeader />`.

> Note: for Step 2 (DashboardPage) the App.jsx call site added in Task 13 already passes `onOpenInquiries`. Steps 3-7 likewise rely on the App.jsx props threaded in Task 13 Step 3.

- [ ] **Step 8: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: all tests pass (including the new `inquiry-validation` tests).

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/DashboardPage.jsx src/components/dashboard/bookings-page/BookingsPage.jsx src/components/dashboard/customers-page/CustomersPage.jsx src/components/dashboard/customers-page/CustomerDetailPage.jsx src/components/dashboard/charges/ChargesPage.jsx src/components/dashboard/payments-connect/PaymentsConnectPage.jsx src/components/dashboard/booking-settings/BookingSettingsPage.jsx
git commit -m "feat(inquiries): show Inquiries tab across dashboard pages"
```

---

## Task 15: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm the widget is served**

Run: `npm run dev`, then open `http://localhost:5190/contact-form.js` (use the dev port from `cors.js` DEFAULT_ALLOWED).
Expected: the widget JS is returned (200), not a 404.

- [ ] **Step 2: Verify the exported HTML includes the widget tag**

In the running app, edit a site and publish (or trigger an export). Inspect the generated HTML and confirm it contains a `<script src="…/contact-form.js" data-site-id="…" data-accent="…" defer></script>` tag in `<head>`.
Expected: the tag is present with the correct `data-site-id`.

- [ ] **Step 3: Submit the form on a published site**

Open the published site, scroll to the Contact section, and confirm the inquiry form renders there. Fill in name/email/message and submit.
Expected: the form is replaced by the "Thanks — we'll be in touch." success state; the network request to `/.netlify/functions/create-inquiry` returns `{ ok: true }`.

- [ ] **Step 4: Verify the honeypot + validation**

Using the browser console or curl, POST to `/.netlify/functions/create-inquiry` with `website` set to a non-empty string and otherwise valid data.
Expected: HTTP 200 with `{ ok: true }` but NO new row is inserted. Then POST with a missing `message` → HTTP 400.

- [ ] **Step 5: Verify the dashboard surface**

Sign in as the site owner. Confirm an **Inquiries** tab appears in the top nav on the Dashboard and other pages. Open it.
Expected: the submission from Step 3 appears as **New**. Open it → drawer shows name, email (mailto), phone (tel), message, received date.

- [ ] **Step 6: Verify status management**

In the drawer, click **Mark read** → pill becomes **Read** and the row is no longer bold. Click **Mark unread** → back to **New**. Click **Archive** → it leaves the Inbox filter and shows under **Archived**; **Restore** brings it back to **Read**. Type an owner note and click elsewhere → reload the page and confirm the note persisted.
Expected: all transitions persist across reload.

- [ ] **Step 7: Verify impersonation read-only**

As a super-admin, impersonate the owner (View as user), open Inquiries, and open an inquiry.
Expected: no action buttons are shown and the owner-notes textarea is read-only.

- [ ] **Step 8: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "fix(inquiries): verification fixups"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** Table + RLS (Task 1) ✓; function with CORS/rate-limit/honeypot/validation/no-email (Tasks 2-3) ✓; config-less widget into `#contact` with fallback (Task 4) ✓; export wiring with accent (Task 5) ✓; dashboard list + read/unread + archive + notes (Tasks 6-11) ✓; nav visible to all (Tasks 12-14) ✓; impersonation read-only (Task 9) ✓; testing — validator unit tests + manual E2E (Tasks 2, 15) ✓.
- **Free-for-all:** `can_inquire_site()` only checks site existence; the function performs no subscription/scheduler gate; the nav item is not wrapped in `showBookingsNav`.
- **Naming consistency:** `validateInquiryPayload`, `listInquiriesForOwner`/`listAllInquiries`, `updateInquiryStatus`, `saveInquiryOwnerNotes`, statuses `new`/`read`/`archived`, honeypot field `website`, prop `onOpenInquiries`, view key `inquiries` — used consistently across all tasks.
- **Out of scope (per spec):** no emails, no per-site toggle, no backfill of already-published sites (owners re-publish), no full CRM pipeline.
