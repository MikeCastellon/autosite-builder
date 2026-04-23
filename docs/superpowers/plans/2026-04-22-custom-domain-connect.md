# Custom Domain Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users connect their own domain (e.g., `mybusiness.com`) to a published site with one click where possible (Domain Connect sync flow on GoDaddy/IONOS) and with copy-pasteable CNAME instructions everywhere else. Cloudflare for SaaS Custom Hostnames does the SSL + routing.

**Architecture:** New Netlify functions (`connect-domain`, `domain-status`, `disconnect-domain`, `domain-sweep`) call the Cloudflare Custom Hostnames API, store state in Supabase, and optionally hand off to a Domain Connect sync URL. Frontend renders a `CustomDomainPanel` component in both the wizard and the dashboard with live status polling. The Cloudflare Worker (separate repo) needs a host-header routing change documented in a runbook.

**Tech Stack:** Vite + React 19, Netlify Functions (Node 20, esbuild), Supabase, Cloudflare for SaaS Custom Hostnames API, `jose` (JWT for state signing), `vitest` (test framework — newly added).

**Spec:** [docs/superpowers/specs/2026-04-22-custom-domain-connect-design.md](../specs/2026-04-22-custom-domain-connect-design.md)

---

## File Structure

**New files in this repo:**

| Path | Responsibility |
|------|---------------|
| `vitest.config.js` | Test framework config |
| `src/lib/domainUtils.js` | Pure functions: normalize, validate, extract apex |
| `src/lib/domainUtils.test.js` | Tests for the above |
| `src/components/CustomDomainPanel.jsx` | Shared UI component (wizard + dashboard) |
| `src/components/customDomain/statusMachine.js` | Pure status-mapping helper (Cloudflare statuses → UI state) |
| `src/components/customDomain/statusMachine.test.js` | Tests for status machine |
| `netlify/functions/_shared/cloudflare.js` | Cloudflare Custom Hostnames API client |
| `netlify/functions/_shared/cloudflare.test.js` | Tests (mocked fetch) |
| `netlify/functions/_shared/domainConnect.js` | TXT lookup + settings fetch + apply URL construction |
| `netlify/functions/_shared/domainConnect.test.js` | Tests (mocked DNS + fetch) |
| `netlify/functions/_shared/stateSig.js` | HMAC sign/verify for redirect state |
| `netlify/functions/_shared/stateSig.test.js` | Tests |
| `netlify/functions/_shared/domainUtils.js` | Copy of src/lib/domainUtils.js (functions bundle separately) |
| `netlify/functions/_shared/auth.js` | Supabase JWT verification + site-ownership check |
| `netlify/functions/_shared/postmark.js` | Postmark send helper |
| `netlify/functions/connect-domain.js` | POST handler: create CF hostnames + return Domain Connect URL or CNAME |
| `netlify/functions/domain-status.js` | GET handler: consolidated CF status |
| `netlify/functions/disconnect-domain.js` | POST handler: delete CF hostnames + clear columns |
| `netlify/functions/domain-sweep.js` | Scheduled (every 2 min): detect SSL-live + send email |
| `public/.well-known/domainconnect/v2/autocaregeniushub.com/settings.json` | Domain Connect provider template |
| `supabase/migrations/20260422000000_custom_domain_columns.sql` | Add tracking columns |
| `docs/superpowers/runbooks/cloudflare-saas-setup.md` | One-time CF manual setup steps |
| `docs/superpowers/runbooks/worker-custom-hostname-routing.md` | Spec for Worker repo change |

**Modified files:**

| Path | Change |
|------|--------|
| `package.json` | Add `vitest` dev dep + `test` script + `jose` |
| `netlify/functions/package.json` | Add `jose` |
| `netlify.toml` | Add `/.well-known/*` redirect exception + scheduled function |
| `.env.example` | Document new env vars |
| `src/lib/publishSite.js` | No signature change needed (already ignores `customDomain`) |
| `src/components/wizard/StepExport.jsx` | Remove stale `useCustomDomain`/`customDomain` state + inline UI, replace with `<CustomDomainPanel siteId={...} />` |
| `src/components/dashboard/DashboardPage.jsx` | Remove `customDomain: site.custom_domain ...` from `publishSite` call; add "Custom domain" button opening panel |
| `netlify/functions/unpublish-site.js` | Also delete CF custom hostnames if present |

---

## Task 1: Add vitest test framework

**Files:**
- Create: `vitest.config.js`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

Run:
```bash
npm install -D vitest@^2.0.0
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'netlify/functions/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Add test script**

Edit `package.json` scripts block to add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Smoke-test vitest is installed**

Run: `npx vitest --version`
Expected: prints a version like `2.x.x`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add vitest test framework"
```

---

## Task 2: Install jose for JWT, and supabase-js in functions dir

**Files:**
- Modify: `package.json`, `netlify/functions/package.json`

- [ ] **Step 1: Install jose in root**

Run:
```bash
npm install jose@^5.0.0
```

- [ ] **Step 2: Install jose in functions dir**

Run:
```bash
cd netlify/functions && npm install jose@^5.0.0
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json netlify/functions/package.json netlify/functions/package-lock.json
git commit -m "chore: add jose for signed state tokens"
```

---

## Task 3: Document new environment variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example**

Replace the contents of `.env.example` with:
```
# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Supabase (required server + client)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cloudflare (required server)
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ZONE_ID=...

# Custom domain feature
CUSTOM_DOMAIN_FALLBACK_ORIGIN=fallback.autocaregeniushub.com
DOMAIN_CONNECT_STATE_SECRET=generate-a-long-random-string
APP_URL=https://app.autocaregenius.com

# Postmark (required for domain-live notification)
POSTMARK_SERVER_TOKEN=...
POSTMARK_FROM_EMAIL=hello@autocaregeniushub.com

# Publishing
VITE_PUBLISH_DOMAIN=autocaregeniushub.com
PUBLISH_DOMAIN=autocaregeniushub.com

# Feature flag
VITE_CUSTOM_DOMAIN_ENABLED=false
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document all env vars including custom domain"
```

---

## Task 4: Supabase migration — add custom domain tracking columns

**Files:**
- Create: `supabase/migrations/20260422000000_custom_domain_columns.sql`

- [ ] **Step 1: Create migration file**

Create the file with:
```sql
-- Custom domain tracking columns
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS custom_hostname_apex_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_hostname_www_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_last_checked_at TIMESTAMPTZ;

-- Fast lookup by custom_domain (partial, only where populated)
CREATE INDEX IF NOT EXISTS idx_sites_custom_domain
  ON sites(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Allowed status values (not a hard enum for flexibility, but documented)
COMMENT ON COLUMN sites.custom_domain_status IS
  'Status enum: pending_dns | active_dns | active_ssl | error_dns | error_ssl | disconnected';
```

- [ ] **Step 2: Apply migration via Supabase dashboard OR MCP**

Use the Supabase MCP `apply_migration` tool or paste the SQL into the Supabase SQL editor for the project.

- [ ] **Step 3: Verify columns exist**

Run in Supabase SQL editor:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sites' AND column_name LIKE 'custom%';
```

Expected output includes: `custom_domain`, `custom_hostname_apex_id`, `custom_hostname_www_id`, `custom_domain_status`, `custom_domain_connected_at`, `custom_domain_last_checked_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422000000_custom_domain_columns.sql
git commit -m "feat: supabase migration for custom domain columns"
```

---

## Task 5: Domain normalization utility (TDD)

**Files:**
- Create: `src/lib/domainUtils.js`
- Test: `src/lib/domainUtils.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/domainUtils.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { normalizeDomain } from './domainUtils.js';

describe('normalizeDomain', () => {
  it('strips protocol, path, trailing slash, and www', () => {
    expect(normalizeDomain('https://www.MyBusiness.com/')).toBe('mybusiness.com');
    expect(normalizeDomain('http://mybusiness.com/foo/bar')).toBe('mybusiness.com');
  });

  it('lowercases the result', () => {
    expect(normalizeDomain('MyBusiness.COM')).toBe('mybusiness.com');
  });

  it('strips leading www.', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  it('handles bare apex input', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain(null)).toBe('');
    expect(normalizeDomain(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/domainUtils.test.js`
Expected: FAIL — `Cannot find module './domainUtils.js'` or `normalizeDomain is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/domainUtils.js`:
```js
export function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return '';
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.split('/')[0];
  d = d.replace(/^www\./, '');
  return d;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/lib/domainUtils.test.js`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domainUtils.js src/lib/domainUtils.test.js
git commit -m "feat: domain normalization utility"
```

---

## Task 6: Domain validation utility (TDD)

**Files:**
- Modify: `src/lib/domainUtils.js`, `src/lib/domainUtils.test.js`

- [ ] **Step 1: Add failing validation tests**

Append to `src/lib/domainUtils.test.js`:
```js
import { isValidDomain } from './domainUtils.js';

describe('isValidDomain', () => {
  it('accepts valid apex domains', () => {
    expect(isValidDomain('example.com')).toBe(true);
    expect(isValidDomain('my-business.co.uk')).toBe(true);
    expect(isValidDomain('a.io')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidDomain('')).toBe(false);
    expect(isValidDomain('not a domain')).toBe(false);
    expect(isValidDomain('http://example.com')).toBe(false);
    expect(isValidDomain('example')).toBe(false);
    expect(isValidDomain('.com')).toBe(false);
    expect(isValidDomain('example.')).toBe(false);
    expect(isValidDomain('-example.com')).toBe(false);
  });

  it('rejects localhost, IPs, reserved', () => {
    expect(isValidDomain('localhost')).toBe(false);
    expect(isValidDomain('127.0.0.1')).toBe(false);
    expect(isValidDomain('192.168.1.1')).toBe(false);
    expect(isValidDomain('example.local')).toBe(false);
  });

  it('rejects strings with uppercase (must be pre-normalized)', () => {
    expect(isValidDomain('Example.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/domainUtils.test.js`
Expected: new tests FAIL — `isValidDomain is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/domainUtils.js`:
```js
const DOMAIN_REGEX = /^(?!-)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const RESERVED_TLDS = new Set(['local', 'localhost', 'test', 'invalid', 'example']);

export function isValidDomain(input) {
  if (!input || typeof input !== 'string') return false;
  if (input !== input.toLowerCase()) return false;
  if (!DOMAIN_REGEX.test(input)) return false;
  const tld = input.split('.').pop();
  if (RESERVED_TLDS.has(tld)) return false;
  return true;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/domainUtils.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domainUtils.js src/lib/domainUtils.test.js
git commit -m "feat: domain validation utility"
```

---

## Task 7: Copy domainUtils into functions shared dir

**Files:**
- Create: `netlify/functions/_shared/domainUtils.js`

- [ ] **Step 1: Create directory and copy**

Run:
```bash
mkdir -p netlify/functions/_shared
cp src/lib/domainUtils.js netlify/functions/_shared/domainUtils.js
```

- [ ] **Step 2: Verify contents match**

Run: `diff src/lib/domainUtils.js netlify/functions/_shared/domainUtils.js`
Expected: no output (identical).

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/_shared/domainUtils.js
git commit -m "chore: mirror domainUtils into functions shared dir"
```

---

## Task 8: State signature utility (HMAC) — TDD

Signed state tokens protect the Domain Connect redirect from CSRF.

**Files:**
- Create: `netlify/functions/_shared/stateSig.js`
- Test: `netlify/functions/_shared/stateSig.test.js`

- [ ] **Step 1: Write failing test**

Create `netlify/functions/_shared/stateSig.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { signState, verifyState } from './stateSig.js';

const SECRET = 'a'.repeat(64);

describe('stateSig', () => {
  beforeEach(() => {
    process.env.DOMAIN_CONNECT_STATE_SECRET = SECRET;
  });

  it('round-trips a payload', async () => {
    const token = await signState({ siteId: 'abc-123' }, 60);
    const result = await verifyState(token);
    expect(result.siteId).toBe('abc-123');
  });

  it('rejects a tampered token', async () => {
    const token = await signState({ siteId: 'abc-123' }, 60);
    const tampered = token.slice(0, -5) + 'XXXXX';
    await expect(verifyState(tampered)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await signState({ siteId: 'abc-123' }, -1);
    await expect(verifyState(token)).rejects.toThrow(/expired/i);
  });

  it('rejects token signed with wrong secret', async () => {
    const token = await signState({ siteId: 'abc-123' }, 60);
    process.env.DOMAIN_CONNECT_STATE_SECRET = 'b'.repeat(64);
    await expect(verifyState(token)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run netlify/functions/_shared/stateSig.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement using jose**

Create `netlify/functions/_shared/stateSig.js`:
```js
import { SignJWT, jwtVerify } from 'jose';

function getSecret() {
  const s = process.env.DOMAIN_CONNECT_STATE_SECRET;
  if (!s || s.length < 32) {
    throw new Error('DOMAIN_CONNECT_STATE_SECRET missing or too short');
  }
  return new TextEncoder().encode(s);
}

export async function signState(payload, expiresInSeconds = 600) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(getSecret());
}

export async function verifyState(token) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run netlify/functions/_shared/stateSig.test.js`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_shared/stateSig.js netlify/functions/_shared/stateSig.test.js
git commit -m "feat: HMAC-signed state tokens for domain connect redirect"
```

---

## Task 9: Cloudflare Custom Hostnames API client — TDD

**Files:**
- Create: `netlify/functions/_shared/cloudflare.js`
- Test: `netlify/functions/_shared/cloudflare.test.js`

- [ ] **Step 1: Write failing tests**

Create `netlify/functions/_shared/cloudflare.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCustomHostname, getCustomHostname, deleteCustomHostname, listCustomHostnames } from './cloudflare.js';

const ZONE = 'zone-123';
const TOKEN = 'cf-token';

describe('cloudflare custom hostnames', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_API_TOKEN = TOKEN;
    process.env.CLOUDFLARE_ZONE_ID = ZONE;
    vi.restoreAllMocks();
  });

  it('createCustomHostname calls POST with correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { id: 'hn-1', hostname: 'x.com', status: 'pending' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCustomHostname('x.com');
    expect(result.id).toBe('hn-1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/custom_hostnames`);
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(opts.body);
    expect(body.hostname).toBe('x.com');
    expect(body.ssl.method).toBe('http');
    expect(body.ssl.type).toBe('dv');
  });

  it('createCustomHostname throws on API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, errors: [{ code: 1414, message: 'hostname already exists' }] }),
    }));

    await expect(createCustomHostname('x.com')).rejects.toThrow(/hostname already exists/);
  });

  it('getCustomHostname returns parsed result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { id: 'hn-1', status: 'active', ssl: { status: 'active' } } }),
    }));

    const result = await getCustomHostname('hn-1');
    expect(result.status).toBe('active');
    expect(result.ssl.status).toBe('active');
  });

  it('deleteCustomHostname succeeds on 200 and 404', async () => {
    const fetch404 = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    vi.stubGlobal('fetch', fetch404);
    await expect(deleteCustomHostname('hn-missing')).resolves.toBe(true);
  });

  it('listCustomHostnames filters by hostname param', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: [{ id: 'hn-1', hostname: 'x.com' }] }),
    }));
    const result = await listCustomHostnames({ hostname: 'x.com' });
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run netlify/functions/_shared/cloudflare.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `netlify/functions/_shared/cloudflare.js`:
```js
const CF_BASE = 'https://api.cloudflare.com/client/v4';

function env() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN missing');
  if (!zone) throw new Error('CLOUDFLARE_ZONE_ID missing');
  return { token, zone };
}

async function cfFetch(path, options = {}) {
  const { token } = env();
  const res = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.errors?.map((e) => e.message).join('; ') || `CF ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.cfBody = body;
    throw err;
  }
  return body.result;
}

export async function createCustomHostname(hostname) {
  const { zone } = env();
  return await cfFetch(`/zones/${zone}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname,
      ssl: { method: 'http', type: 'dv' },
    }),
  });
}

export async function getCustomHostname(id) {
  const { zone } = env();
  return await cfFetch(`/zones/${zone}/custom_hostnames/${id}`);
}

export async function deleteCustomHostname(id) {
  const { zone } = env();
  try {
    await cfFetch(`/zones/${zone}/custom_hostnames/${id}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    if (err.status === 404) return true; // already gone
    throw err;
  }
}

export async function listCustomHostnames({ hostname } = {}) {
  const { zone } = env();
  const qs = hostname ? `?hostname=${encodeURIComponent(hostname)}` : '';
  return await cfFetch(`/zones/${zone}/custom_hostnames${qs}`);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run netlify/functions/_shared/cloudflare.test.js`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_shared/cloudflare.js netlify/functions/_shared/cloudflare.test.js
git commit -m "feat: cloudflare custom hostnames api client"
```

---

## Task 10: Domain Connect discovery — TDD

Detects whether a domain's registrar supports Domain Connect and returns sync apply URL.

**Files:**
- Create: `netlify/functions/_shared/domainConnect.js`
- Test: `netlify/functions/_shared/domainConnect.test.js`

- [ ] **Step 1: Write failing tests**

Create `netlify/functions/_shared/domainConnect.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverDomainConnect, buildApplyUrl } from './domainConnect.js';

describe('domainConnect', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildApplyUrl', () => {
    it('constructs a complete sync apply URL', () => {
      const url = buildApplyUrl({
        urlSyncUX: 'https://dcc.godaddy.com',
        providerId: 'autocaregeniushub.com',
        serviceId: 'customdomain',
        domain: 'mybusiness.com',
        redirectUri: 'https://app.example.com/domain-connected',
        state: 'signedstate',
      });

      expect(url).toContain('https://dcc.godaddy.com');
      expect(url).toContain('/v2/domainTemplates/providers/autocaregeniushub.com/services/customdomain/apply');
      expect(url).toContain('domain=mybusiness.com');
      expect(url).toContain('state=signedstate');
      expect(url).toContain(`redirect_uri=${encodeURIComponent('https://app.example.com/domain-connected')}`);
    });
  });

  describe('discoverDomainConnect', () => {
    it('returns null when no TXT record exists', async () => {
      const resolve = vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENODATA' }));
      const result = await discoverDomainConnect('mybusiness.com', { resolveTxt: resolve });
      expect(result).toBeNull();
    });

    it('returns provider info when TXT + settings succeed', async () => {
      const resolve = vi.fn().mockResolvedValue([['api.godaddy.com/v1/domains/settings']]);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          urlSyncUX: 'https://dcc.godaddy.com',
          providerId: 'godaddy',
          providerName: 'GoDaddy',
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await discoverDomainConnect('mybusiness.com', { resolveTxt: resolve });
      expect(result.providerName).toBe('GoDaddy');
      expect(result.urlSyncUX).toBe('https://dcc.godaddy.com');
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.godaddy.com/v1/domains/settings/v2/mybusiness.com/settings');
    });

    it('returns null when settings fetch fails', async () => {
      const resolve = vi.fn().mockResolvedValue([['api.godaddy.com/v1/domains/settings']]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const result = await discoverDomainConnect('mybusiness.com', { resolveTxt: resolve });
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run netlify/functions/_shared/domainConnect.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `netlify/functions/_shared/domainConnect.js`:
```js
import dns from 'node:dns/promises';

/**
 * Looks up _domainconnect.<domain> TXT record to find registrar's Domain Connect API base,
 * then fetches provider settings.
 * Returns null if domain does not support Domain Connect.
 *
 * @param {string} domain - apex domain, e.g. "mybusiness.com"
 * @param {object} [opts] - { resolveTxt } for dependency injection in tests
 */
export async function discoverDomainConnect(domain, opts = {}) {
  const resolveTxt = opts.resolveTxt || dns.resolveTxt;
  let apiBase;
  try {
    const records = await resolveTxt(`_domainconnect.${domain}`);
    apiBase = records[0]?.[0];
    if (!apiBase) return null;
  } catch {
    return null;
  }

  const settingsUrl = `https://${apiBase.replace(/^https?:\/\//, '')}/v2/${domain}/settings`;
  try {
    const res = await fetch(settingsUrl);
    if (!res.ok) return null;
    const settings = await res.json();
    if (!settings.urlSyncUX) return null;
    return {
      urlSyncUX: settings.urlSyncUX,
      providerId: settings.providerId,
      providerName: settings.providerName || settings.providerId,
    };
  } catch {
    return null;
  }
}

/**
 * Constructs the full sync apply URL a user is redirected to.
 */
export function buildApplyUrl({ urlSyncUX, providerId, serviceId, domain, redirectUri, state }) {
  const base = urlSyncUX.replace(/\/$/, '');
  const path = `/v2/domainTemplates/providers/${providerId}/services/${serviceId}/apply`;
  const params = new URLSearchParams({
    domain,
    redirect_uri: redirectUri,
    state,
  });
  return `${base}${path}?${params.toString()}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run netlify/functions/_shared/domainConnect.test.js`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_shared/domainConnect.js netlify/functions/_shared/domainConnect.test.js
git commit -m "feat: domain connect discovery + apply url builder"
```

---

## Task 11: Supabase auth helper — site ownership verification

**Files:**
- Create: `netlify/functions/_shared/auth.js`

- [ ] **Step 1: Write helper**

Create `netlify/functions/_shared/auth.js`:
```js
import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Verify the request is authenticated and the user owns the site.
 * Returns { user, site } or throws an Error with .status code.
 */
export async function requireSiteOwner(event, siteId) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const token = auth.slice(7);

  const anon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    const err = new Error('Invalid token');
    err.status = 401;
    throw err;
  }

  const admin = supabaseAdmin();
  const { data: site, error: siteErr } = await admin
    .from('sites').select('*').eq('id', siteId).maybeSingle();
  if (siteErr || !site) {
    const err = new Error('Site not found');
    err.status = 404;
    throw err;
  }
  if (site.user_id !== userData.user.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return { user: userData.user, site };
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/_shared/auth.js
git commit -m "feat: supabase auth helper with site-ownership check"
```

---

## Task 12: connect-domain function — scaffold + happy path

**Files:**
- Create: `netlify/functions/connect-domain.js`

- [ ] **Step 1: Write the function**

Create `netlify/functions/connect-domain.js`:
```js
import { normalizeDomain, isValidDomain } from './_shared/domainUtils.js';
import { createCustomHostname, listCustomHostnames, deleteCustomHostname } from './_shared/cloudflare.js';
import { discoverDomainConnect, buildApplyUrl } from './_shared/domainConnect.js';
import { signState } from './_shared/stateSig.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const FALLBACK = process.env.CUSTOM_DOMAIN_FALLBACK_ORIGIN;
const APP_URL = process.env.APP_URL;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId, domain: rawDomain } = body;
  if (!siteId || !rawDomain) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'siteId and domain required' }) };
  }

  const apex = normalizeDomain(rawDomain);
  if (!isValidDomain(apex)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid domain' }) };
  }
  const www = `www.${apex}`;

  try {
    // 1. Auth + site ownership
    await requireSiteOwner(event, siteId);

    // 2. Check for conflict: another site already owns this domain
    const admin = supabaseAdmin();
    const { data: conflict } = await admin
      .from('sites').select('id').eq('custom_domain', apex).neq('id', siteId).maybeSingle();
    if (conflict) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Domain already connected to another site' }) };
    }

    // 3. Create (or recover) Cloudflare hostnames for apex + www
    const apexHn = await createOrRecover(apex);
    const wwwHn = await createOrRecover(www);

    // 4. Domain Connect discovery (fire and forget result if fails)
    const provider = await discoverDomainConnect(apex).catch(() => null);

    // 5. Persist to Supabase
    await admin.from('sites').update({
      custom_domain: apex,
      custom_hostname_apex_id: apexHn.id,
      custom_hostname_www_id: wwwHn.id,
      custom_domain_status: 'pending_dns',
      custom_domain_connected_at: new Date().toISOString(),
      custom_domain_last_checked_at: new Date().toISOString(),
    }).eq('id', siteId);

    // 6. Build CNAME instructions (always returned as fallback)
    const cnameInstructions = [
      { type: 'CNAME', host: '@',   value: FALLBACK },
      { type: 'CNAME', host: 'www', value: FALLBACK },
    ];
    // Include ownership verification records from Cloudflare
    if (apexHn.ownership_verification) {
      cnameInstructions.push({
        type: apexHn.ownership_verification.type,
        host: apexHn.ownership_verification.name,
        value: apexHn.ownership_verification.value,
      });
    }

    // 7. Construct Domain Connect apply URL if supported
    let applyUrl = null;
    let detectedProvider = null;
    if (provider) {
      const state = await signState({ siteId }, 600);
      applyUrl = buildApplyUrl({
        urlSyncUX: provider.urlSyncUX,
        providerId: 'autocaregeniushub.com',
        serviceId: 'customdomain',
        domain: apex,
        redirectUri: `${APP_URL}/domain-connected`,
        state,
      });
      detectedProvider = provider.providerName;
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        applyUrl,
        detectedProvider,
        cnameInstructions,
        hostnameIds: { apex: apexHn.id, www: wwwHn.id },
        status: 'pending_dns',
      }),
    };
  } catch (err) {
    const status = err.status || 500;
    console.error('connect-domain error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

async function createOrRecover(hostname) {
  try {
    return await createCustomHostname(hostname);
  } catch (err) {
    // Handle orphan from prior failed delete: find existing, delete, retry once
    if (err.status === 409) {
      const existing = await listCustomHostnames({ hostname });
      if (existing?.length > 0) {
        await deleteCustomHostname(existing[0].id);
        return await createCustomHostname(hostname);
      }
    }
    throw err;
  }
}
```

- [ ] **Step 2: Commit (no test yet — integration tested via manual E2E in Task 23)**

```bash
git add netlify/functions/connect-domain.js
git commit -m "feat: connect-domain function (Cloudflare hostnames + Domain Connect)"
```

---

## Task 13: domain-status function

**Files:**
- Create: `netlify/functions/domain-status.js`

- [ ] **Step 1: Write the function**

Create `netlify/functions/domain-status.js`:
```js
import { getCustomHostname } from './_shared/cloudflare.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';
import { consolidateStatus } from './_shared/statusMachine.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const CACHE_TTL_MS = 2000;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const siteId = event.queryStringParameters?.siteId;
  if (!siteId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'siteId required' }) };
  }

  try {
    const { site } = await requireSiteOwner(event, siteId);
    if (!site.custom_hostname_apex_id) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'disconnected', domain: null }) };
    }

    // 2-second cached read
    const lastChecked = site.custom_domain_last_checked_at ? new Date(site.custom_domain_last_checked_at).getTime() : 0;
    if (Date.now() - lastChecked < CACHE_TTL_MS && site.custom_domain_status) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        domain: site.custom_domain,
        status: site.custom_domain_status,
        cached: true,
      }) };
    }

    // Fresh check
    const [apex, www] = await Promise.all([
      getCustomHostname(site.custom_hostname_apex_id),
      getCustomHostname(site.custom_hostname_www_id),
    ]);

    const consolidated = consolidateStatus(apex, www);
    await supabaseAdmin().from('sites').update({
      custom_domain_status: consolidated.status,
      custom_domain_last_checked_at: new Date().toISOString(),
    }).eq('id', siteId);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      domain: site.custom_domain,
      status: consolidated.status,
      message: consolidated.message,
      apex: { cloudflareStatus: apex.status, sslStatus: apex.ssl?.status },
      www:  { cloudflareStatus: www.status,  sslStatus: www.ssl?.status },
    }) };
  } catch (err) {
    const status = err.status || 500;
    console.error('domain-status error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/domain-status.js
git commit -m "feat: domain-status function with 2s cache"
```

---

## Task 14: Status machine (TDD) — server-side consolidation

**Files:**
- Create: `netlify/functions/_shared/statusMachine.js`
- Test: `netlify/functions/_shared/statusMachine.test.js`

- [ ] **Step 1: Write failing tests**

Create `netlify/functions/_shared/statusMachine.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { consolidateStatus } from './statusMachine.js';

describe('consolidateStatus', () => {
  it('both pending → pending_dns', () => {
    const apex = { status: 'pending', ssl: { status: 'pending_validation' } };
    const www  = { status: 'pending', ssl: { status: 'pending_validation' } };
    expect(consolidateStatus(apex, www).status).toBe('pending_dns');
  });

  it('both active, SSL pending → active_dns', () => {
    const apex = { status: 'active', ssl: { status: 'pending_validation' } };
    const www  = { status: 'active', ssl: { status: 'pending_issuance' } };
    expect(consolidateStatus(apex, www).status).toBe('active_dns');
  });

  it('both active, SSL active → active_ssl (live)', () => {
    const apex = { status: 'active', ssl: { status: 'active' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    expect(consolidateStatus(apex, www).status).toBe('active_ssl');
  });

  it('one active one pending → still pending_dns', () => {
    const apex = { status: 'active', ssl: { status: 'active' } };
    const www  = { status: 'pending', ssl: { status: 'pending_validation' } };
    expect(consolidateStatus(apex, www).status).toBe('pending_dns');
  });

  it('blocked or moved → error_dns', () => {
    const apex = { status: 'blocked', ssl: { status: 'pending_validation' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    expect(consolidateStatus(apex, www).status).toBe('error_dns');
  });

  it('ssl issuance failed → error_ssl', () => {
    const apex = { status: 'active', ssl: { status: 'timing_out' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    expect(consolidateStatus(apex, www).status).toBe('error_ssl');
  });

  it('returns a human-readable message', () => {
    const apex = { status: 'active', ssl: { status: 'active' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    const { message } = consolidateStatus(apex, www);
    expect(message).toMatch(/live/i);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run netlify/functions/_shared/statusMachine.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `netlify/functions/_shared/statusMachine.js`:
```js
const DNS_ERROR_STATES = new Set(['blocked', 'moved', 'deleted']);
const SSL_ERROR_STATES = new Set(['timing_out', 'deleted']);

export function consolidateStatus(apex, www) {
  const apexDns = apex?.status;
  const wwwDns  = www?.status;
  const apexSsl = apex?.ssl?.status;
  const wwwSsl  = www?.ssl?.status;

  if (DNS_ERROR_STATES.has(apexDns) || DNS_ERROR_STATES.has(wwwDns)) {
    return { status: 'error_dns', message: 'DNS validation failed. Check your CNAME records.' };
  }
  if (SSL_ERROR_STATES.has(apexSsl) || SSL_ERROR_STATES.has(wwwSsl)) {
    return { status: 'error_ssl', message: 'SSL certificate issuance failed. Try reconnecting.' };
  }
  if (apexDns !== 'active' || wwwDns !== 'active') {
    return { status: 'pending_dns', message: 'Waiting for DNS to propagate (usually 1–5 minutes).' };
  }
  if (apexSsl !== 'active' || wwwSsl !== 'active') {
    return { status: 'active_dns', message: 'DNS verified. SSL certificate issuing (usually under 5 minutes).' };
  }
  return { status: 'active_ssl', message: 'Your site is live on your custom domain!' };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run netlify/functions/_shared/statusMachine.test.js`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_shared/statusMachine.js netlify/functions/_shared/statusMachine.test.js
git commit -m "feat: consolidated custom hostname status machine"
```

---

## Task 15: disconnect-domain function

**Files:**
- Create: `netlify/functions/disconnect-domain.js`

- [ ] **Step 1: Write the function**

Create `netlify/functions/disconnect-domain.js`:
```js
import { deleteCustomHostname } from './_shared/cloudflare.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId } = body;
  if (!siteId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'siteId required' }) };
  }

  try {
    const { site } = await requireSiteOwner(event, siteId);

    const deletions = [];
    if (site.custom_hostname_apex_id) deletions.push(deleteCustomHostname(site.custom_hostname_apex_id).catch((e) => console.error(e)));
    if (site.custom_hostname_www_id)  deletions.push(deleteCustomHostname(site.custom_hostname_www_id).catch((e) => console.error(e)));
    await Promise.all(deletions);

    await supabaseAdmin().from('sites').update({
      custom_domain: null,
      custom_hostname_apex_id: null,
      custom_hostname_www_id: null,
      custom_domain_status: 'disconnected',
      custom_domain_connected_at: null,
      custom_domain_last_checked_at: null,
    }).eq('id', siteId);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ disconnected: true }) };
  } catch (err) {
    const status = err.status || 500;
    console.error('disconnect-domain error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/disconnect-domain.js
git commit -m "feat: disconnect-domain function"
```

---

## Task 16: Update unpublish-site to tear down custom hostnames

**Files:**
- Modify: `netlify/functions/unpublish-site.js`

- [ ] **Step 1: Rewrite to include hostname cleanup**

Replace contents of `netlify/functions/unpublish-site.js` with:
```js
import { deleteCustomHostname } from './_shared/cloudflare.js';
import { supabaseAdmin } from './_shared/auth.js';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET = 'autosite-published';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: '{"error":"Invalid JSON"}' }; }

  const { slug, siteId } = body;
  if (!slug) return { statusCode: 400, headers: CORS, body: '{"error":"Missing slug"}' };

  try {
    // Delete R2 object
    const r2Key = `${slug}/index.html`;
    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(r2Key)}`;
    await fetch(r2Url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    });

    // Tear down custom hostnames if present
    if (siteId) {
      const admin = supabaseAdmin();
      const { data: site } = await admin.from('sites').select('custom_hostname_apex_id, custom_hostname_www_id').eq('id', siteId).maybeSingle();
      if (site) {
        const deletions = [];
        if (site.custom_hostname_apex_id) deletions.push(deleteCustomHostname(site.custom_hostname_apex_id).catch((e) => console.error(e)));
        if (site.custom_hostname_www_id)  deletions.push(deleteCustomHostname(site.custom_hostname_www_id).catch((e) => console.error(e)));
        await Promise.all(deletions);
      }
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
```

- [ ] **Step 2: Update DashboardPage to pass siteId on delete**

In `src/components/dashboard/DashboardPage.jsx`, replace the body inside `handleDelete`:
```jsx
  const handleDelete = async (id) => {
    if (!confirm('Delete this site? This will also unpublish it and remove any custom domain.')) return;
    const site = sites.find(s => s.id === id);
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) {
      alert('Failed to delete site. Please try again.');
      return;
    }
    if (site?.slug) {
      fetch('/.netlify/functions/unpublish-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: site.slug, siteId: site.id }),
      }).catch(() => {});
    }
    setSites((prev) => prev.filter((s) => s.id !== id));
  };
```

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/unpublish-site.js src/components/dashboard/DashboardPage.jsx
git commit -m "feat: unpublish-site tears down custom hostnames too"
```

---

## Task 17: Domain Connect static template

**Files:**
- Create: `public/.well-known/domainconnect/v2/autocaregeniushub.com/settings.json`

- [ ] **Step 1: Create directory**

Run:
```bash
mkdir -p public/.well-known/domainconnect/v2/autocaregeniushub.com
```

- [ ] **Step 2: Create settings.json**

Create `public/.well-known/domainconnect/v2/autocaregeniushub.com/settings.json`:
```json
{
  "providerId": "autocaregeniushub.com",
  "providerName": "AutoCareGenius",
  "providerDisplayName": "AutoCare Genius Website Builder",
  "serviceId": "customdomain",
  "serviceName": "Custom Domain",
  "serviceDisplayName": "Connect your domain to AutoCareGenius",
  "description": "Point this domain at your AutoCareGenius website.",
  "variableDescription": "Your AutoCareGenius site",
  "syncBlock": false,
  "sharedProviderName": true,
  "records": [
    { "type": "CNAME", "host": "@",   "pointsTo": "fallback.autocaregeniushub.com", "ttl": 3600 },
    { "type": "CNAME", "host": "www", "pointsTo": "fallback.autocaregeniushub.com", "ttl": 3600 }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add public/.well-known/domainconnect
git commit -m "feat: domain connect provider template"
```

---

## Task 18: Update netlify.toml — /.well-known/* exception + scheduled function

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 1: Update netlify.toml**

Replace the entire `netlify.toml` with:
```toml
[build]
  command = "npm install --prefix netlify/functions && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[functions."domain-sweep"]
  schedule = "*/2 * * * *"

[dev]
  command = "node ./node_modules/vite/bin/vite.js --port 5190"
  targetPort = 5190
  port = 8890
  host = "127.0.0.1"
  publish = "dist"
  autoLaunch = false

# Serve /.well-known/* directly from public/ (no SPA rewrite)
[[redirects]]
  from = "/.well-known/*"
  to = "/.well-known/:splat"
  status = 200

# SPA fallback for everything else
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 2: Verify locally**

Run `npm run build` and confirm `dist/.well-known/domainconnect/v2/autocaregeniushub.com/settings.json` exists.

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "feat: serve /.well-known/* + schedule domain-sweep"
```

---

## Task 19: Postmark send helper

**Files:**
- Create: `netlify/functions/_shared/postmark.js`

- [ ] **Step 1: Write helper**

Create `netlify/functions/_shared/postmark.js`:
```js
const POSTMARK_URL = 'https://api.postmarkapp.com/email';

export async function sendPostmarkEmail({ to, subject, htmlBody, textBody }) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.POSTMARK_FROM_EMAIL;
  if (!token || !from) throw new Error('Postmark env not configured');

  const res = await fetch(POSTMARK_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Postmark ${res.status}: ${err.Message || 'unknown'}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/_shared/postmark.js
git commit -m "feat: postmark send helper"
```

---

## Task 20: domain-sweep scheduled function

Scheduled every 2 minutes by `netlify.toml`. Finds sites in `active_dns` status, re-checks Cloudflare, emails on `active_ssl` transition.

**Files:**
- Create: `netlify/functions/domain-sweep.js`

- [ ] **Step 1: Write the function**

Create `netlify/functions/domain-sweep.js`:
```js
import { getCustomHostname } from './_shared/cloudflare.js';
import { consolidateStatus } from './_shared/statusMachine.js';
import { supabaseAdmin } from './_shared/auth.js';
import { sendPostmarkEmail } from './_shared/postmark.js';

export const handler = async () => {
  const admin = supabaseAdmin();

  // Only care about sites that have a hostname and are not yet live.
  const { data: sites } = await admin
    .from('sites')
    .select('id, custom_domain, custom_hostname_apex_id, custom_hostname_www_id, custom_domain_status, user_id')
    .not('custom_hostname_apex_id', 'is', null)
    .in('custom_domain_status', ['pending_dns', 'active_dns']);

  if (!sites?.length) return { statusCode: 200, body: 'no sites to sweep' };

  for (const site of sites) {
    try {
      const [apex, www] = await Promise.all([
        getCustomHostname(site.custom_hostname_apex_id),
        getCustomHostname(site.custom_hostname_www_id),
      ]);
      const { status } = consolidateStatus(apex, www);
      const prev = site.custom_domain_status;

      await admin.from('sites').update({
        custom_domain_status: status,
        custom_domain_last_checked_at: new Date().toISOString(),
      }).eq('id', site.id);

      if (status === 'active_ssl' && prev !== 'active_ssl') {
        // Look up user email
        const { data: userRes } = await admin.auth.admin.getUserById(site.user_id);
        const email = userRes?.user?.email;
        if (email) {
          await sendPostmarkEmail({
            to: email,
            subject: `Your domain ${site.custom_domain} is live!`,
            htmlBody: `<p>Great news — your custom domain <strong>${site.custom_domain}</strong> is now serving your website over HTTPS.</p><p><a href="https://${site.custom_domain}">Visit your site</a></p>`,
            textBody: `Your custom domain ${site.custom_domain} is now live: https://${site.custom_domain}`,
          }).catch((e) => console.error('email send failed', e));
        }
      }
    } catch (err) {
      console.error(`sweep failed for site ${site.id}`, err);
    }
  }

  return { statusCode: 200, body: `swept ${sites.length} sites` };
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/domain-sweep.js
git commit -m "feat: scheduled domain-sweep for ssl-live detection + email"
```

---

## Task 21: Client-side status machine mirror (for UI polling)

The UI polling response already includes a `status` string from the server — but we need a small helper for mapping status → display config (colors, messages, icon).

**Files:**
- Create: `src/components/customDomain/statusMachine.js`
- Test: `src/components/customDomain/statusMachine.test.js`

- [ ] **Step 1: Write failing test**

Create `src/components/customDomain/statusMachine.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { getStatusDisplay } from './statusMachine.js';

describe('getStatusDisplay', () => {
  it('pending_dns shows DNS copy', () => {
    const d = getStatusDisplay('pending_dns');
    expect(d.label).toMatch(/DNS/i);
    expect(d.tone).toBe('pending');
  });

  it('active_ssl shows live', () => {
    const d = getStatusDisplay('active_ssl');
    expect(d.label).toMatch(/live/i);
    expect(d.tone).toBe('success');
  });

  it('error_dns shows retry hint', () => {
    const d = getStatusDisplay('error_dns');
    expect(d.tone).toBe('error');
  });

  it('unknown status falls back safely', () => {
    const d = getStatusDisplay('quantum_state');
    expect(d.label).toBeTruthy();
    expect(d.tone).toBe('pending');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/components/customDomain/statusMachine.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/customDomain/statusMachine.js`:
```js
const MAP = {
  disconnected:  { label: 'Not connected',              tone: 'neutral' },
  pending_dns:   { label: 'Waiting for DNS (1–5 min)',  tone: 'pending' },
  active_dns:    { label: 'DNS verified, issuing SSL',  tone: 'pending' },
  active_ssl:    { label: 'Live on your custom domain', tone: 'success' },
  error_dns:     { label: 'DNS setup issue',            tone: 'error'   },
  error_ssl:     { label: 'SSL issuance failed',        tone: 'error'   },
};

export function getStatusDisplay(status) {
  return MAP[status] || { label: 'Checking...', tone: 'pending' };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/components/customDomain/statusMachine.test.js`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/customDomain/statusMachine.js src/components/customDomain/statusMachine.test.js
git commit -m "feat: client status display helper"
```

---

## Task 22: CustomDomainPanel component

The main UI. One component used in both wizard and dashboard.

**Files:**
- Create: `src/components/CustomDomainPanel.jsx`

- [ ] **Step 1: Write the component**

Create `src/components/CustomDomainPanel.jsx`:
```jsx
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getStatusDisplay } from './customDomain/statusMachine.js';
import { normalizeDomain, isValidDomain } from '../lib/domainUtils.js';

const POLL_INTERVAL_MS = 3000;

export default function CustomDomainPanel({ siteId, initialDomain = null, initialStatus = 'disconnected' }) {
  const [input, setInput] = useState('');
  const [domain, setDomain] = useState(initialDomain);
  const [status, setStatus] = useState(initialStatus);
  const [cnameInstructions, setCnameInstructions] = useState(null);
  const [applyUrl, setApplyUrl] = useState(null);
  const [provider, setProvider] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const pollingRef = useRef(null);

  const display = getStatusDisplay(status);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }

  const handleConnect = async () => {
    setErr(null);
    const apex = normalizeDomain(input);
    if (!isValidDomain(apex)) {
      setErr('Please enter a valid domain (e.g., mybusiness.com)');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/connect-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ siteId, domain: apex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connect failed');

      setDomain(apex);
      setCnameInstructions(data.cnameInstructions);
      setApplyUrl(data.applyUrl);
      setProvider(data.detectedProvider);
      setStatus(data.status);

      if (data.applyUrl) {
        const popup = window.open(data.applyUrl, 'domainconnect', 'width=600,height=700');
        if (!popup) {
          // Popup blocked → fall back to same-window redirect
          window.location.href = data.applyUrl;
        }
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Remove your custom domain? Your site will continue to serve on its subdomain.')) return;
    setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/disconnect-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed');
      setDomain(null);
      setInput('');
      setStatus('disconnected');
      setCnameInstructions(null);
      setApplyUrl(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Status polling
  useEffect(() => {
    if (status === 'disconnected' || status === 'active_ssl') {
      clearInterval(pollingRef.current);
      return;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/.netlify/functions/domain-status?siteId=${siteId}`, {
          headers: { ...(await authHeader()) },
        });
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
      } catch {}
    }, POLL_INTERVAL_MS);
    return () => clearInterval(pollingRef.current);
  }, [status, siteId]);

  if (!domain) {
    return (
      <div className="border border-black/[0.07] rounded-xl p-5">
        <p className="text-[13px] font-semibold text-[#1a1a1a] mb-2">Use your own domain</p>
        <p className="text-xs text-[#999] mb-3">Connect a domain you already own (like mybusiness.com).</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="mybusiness.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-black/[0.10] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000]"
          />
          <button
            onClick={handleConnect}
            disabled={busy || !input}
            className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${busy || !input ? 'bg-[#f2f0ec] text-[#888] cursor-not-allowed' : 'bg-[#cc0000] hover:bg-[#aa0000] text-white'}`}
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </div>
        {err && <p className="text-xs text-[#cc0000] mt-2">{err}</p>}
      </div>
    );
  }

  return (
    <div className="border border-black/[0.07] rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-[#1a1a1a]">{domain}</p>
        <button onClick={handleDisconnect} disabled={busy} className="text-xs text-[#888] hover:text-[#cc0000]">
          Remove
        </button>
      </div>
      <p className={`text-xs mb-3 ${display.tone === 'success' ? 'text-green-600' : display.tone === 'error' ? 'text-[#cc0000]' : 'text-[#888]'}`}>
        {display.label}
      </p>

      {provider && status !== 'active_ssl' && (
        <p className="text-xs text-[#555] mb-3">
          Detected registrar: <strong>{provider}</strong>. If the popup didn't open, <a href={applyUrl} className="text-[#cc0000] underline">click here to authorize</a>.
        </p>
      )}

      {!provider && status !== 'active_ssl' && cnameInstructions && (
        <div className="bg-[#faf9f7] border border-black/[0.07] rounded-lg p-3 font-mono text-xs text-[#555] space-y-1">
          <p className="font-semibold text-[#1a1a1a] mb-2">Add these DNS records at your registrar:</p>
          {cnameInstructions.map((r, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-16 shrink-0 text-[#888]">{r.type}</span>
              <span className="w-24 shrink-0">{r.host}</span>
              <span className="break-all">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-xs text-[#cc0000] mt-2">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CustomDomainPanel.jsx
git commit -m "feat: CustomDomainPanel component"
```

---

## Task 23: /domain-connected callback route handler

Handles the post-Domain-Connect redirect. Since the app uses state-driven routing (no router visible), handle the `/domain-connected` path via a check in `App.jsx` or via the popup closing itself.

**Files:**
- Modify: `src/App.jsx` (locate file first — see step 1)

- [ ] **Step 1: Locate App.jsx**

Run: `ls src/App.jsx src/main.jsx` to confirm file names. (If structure differs, use whichever entry file renders the top-level router or view switcher.)

- [ ] **Step 2: Add window.opener close handling**

At the top of the App component's render, before any state-based routing, add:
```jsx
// If opened as popup from Domain Connect redirect, post a message to opener and close.
if (typeof window !== 'undefined' && window.location.pathname === '/domain-connected') {
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'domain-connected' }, window.location.origin);
      window.close();
    }
  } catch {}
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="text-center">
        <p className="text-lg font-semibold text-[#1a1a1a] mb-2">Domain connected!</p>
        <p className="text-sm text-[#888]">You can close this window and return to the app.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add message listener in CustomDomainPanel**

Edit `src/components/CustomDomainPanel.jsx` to add a useEffect listening for `postMessage`:
```jsx
useEffect(() => {
  const onMessage = (e) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type === 'domain-connected') {
      // Kick off an immediate status check (polling is already running)
      fetch(`/.netlify/functions/domain-status?siteId=${siteId}`).catch(() => {});
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}, [siteId]);
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/CustomDomainPanel.jsx
git commit -m "feat: handle /domain-connected popup callback"
```

---

## Task 24: Wire CustomDomainPanel into StepExport + clean up stale code

**Files:**
- Modify: `src/components/wizard/StepExport.jsx`

- [ ] **Step 1: Replace the stale custom-domain UI with the shared panel**

Replace the contents of `src/components/wizard/StepExport.jsx`:
```jsx
import { useState } from 'react';
import { publishSite } from '../../lib/publishSite.js';
import { generateSlug } from '../../lib/publishUtils.js';
import CustomDomainPanel from '../CustomDomainPanel.jsx';

const PUBLISH_DOMAIN = import.meta.env.VITE_PUBLISH_DOMAIN || 'autocaregenius.com';
const CUSTOM_DOMAIN_ENABLED = import.meta.env.VITE_CUSTOM_DOMAIN_ENABLED === 'true';

export default function StepExport({ siteId: passedSiteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, onBack, onStartOver }) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const siteId = passedSiteId || crypto.randomUUID();

  const slug = generateSlug(businessInfo.businessName);
  const subdomain = `${slug}.${PUBLISH_DOMAIN}`;

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishSite({
        siteId,
        businessInfo,
        generatedCopy,
        templateId,
        templateMeta,
        images,
        selectedWidgetIds,
      });
      setPublished(result);
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-[#cc0000]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] mb-2 tracking-[-1px] leading-[1.1]">
          {published ? 'Your site is live!' : 'Publish Your Website'}
        </h1>
        <p className="text-[#555] text-[15px]">
          {businessInfo.businessName} &mdash; {businessInfo.city}, {businessInfo.state}
        </p>
      </div>

      {!published ? (
        <>
          <div className="border border-black/[0.07] rounded-xl p-5 mb-5 bg-[#faf9f7]">
            <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">Your site will be live at</p>
            <div className="flex items-center gap-2 bg-white border border-black/[0.10] rounded-lg px-4 py-3">
              <span className="text-green-500 text-sm">🔒</span>
              <span className="font-mono text-sm text-[#1a1a1a] break-all">https://{subdomain}</span>
            </div>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className={`w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] transition-all mb-4
              ${publishing ? 'bg-[#f2f0ec] text-[#888] cursor-not-allowed' : 'bg-[#cc0000] hover:bg-[#aa0000] text-white'}`}
          >
            {publishing ? 'Publishing...' : '🚀 Publish Website'}
          </button>

          {publishError && <p className="text-sm text-[#cc0000] mb-4">{publishError}</p>}
        </>
      ) : (
        <>
          <div className="border border-green-200 bg-green-50 rounded-xl p-5 mb-5">
            <p className="font-semibold text-green-800 mb-2">🎉 Your site is live!</p>
            <a
              href={published.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-green-700 underline break-all font-mono"
            >
              {published.publishedUrl}
            </a>
          </div>

          {CUSTOM_DOMAIN_ENABLED && (
            <div className="mb-5">
              <CustomDomainPanel siteId={siteId} />
            </div>
          )}

          <div className="flex gap-2 mb-5">
            <button
              onClick={() => navigator.clipboard.writeText(published.publishedUrl)}
              className="flex-1 py-2.5 px-4 border border-black/[0.07] rounded-xl text-sm font-medium hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
            >
              📋 Copy Link
            </button>
            <a
              href={published.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 border border-black/[0.07] rounded-xl text-sm font-medium hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors text-center"
            >
              🔗 Visit Site
            </a>
          </div>

          <div className="flex gap-2">
            <button onClick={onBack} className="flex-1 py-2.5 px-4 text-sm text-[#888]">Back</button>
            <button onClick={onStartOver} className="flex-1 py-2.5 px-4 text-sm text-[#888]">Start over</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/StepExport.jsx
git commit -m "refactor: StepExport uses shared CustomDomainPanel, removes stub"
```

---

## Task 25: Wire CustomDomainPanel into Dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardPage.jsx`

- [ ] **Step 1: Remove stale customDomain param in handleRepublish**

Find the `handleRepublish` function and remove the `customDomain: site.custom_domain || null,` line from the `publishSite` call.

- [ ] **Step 2: Add a "Custom domain" button that opens the panel in a modal**

Add state near the top of the component:
```jsx
const [domainPanelSiteId, setDomainPanelSiteId] = useState(null);
const [domainPanelInitial, setDomainPanelInitial] = useState(null);
const CUSTOM_DOMAIN_ENABLED = import.meta.env.VITE_CUSTOM_DOMAIN_ENABLED === 'true';
```

Add the import at the top:
```jsx
import CustomDomainPanel from '../CustomDomainPanel.jsx';
```

In the per-site card action button group (near the Republish button), add:
```jsx
{CUSTOM_DOMAIN_ENABLED && site.published_url && (
  <button
    onClick={() => {
      setDomainPanelSiteId(site.id);
      setDomainPanelInitial({ domain: site.custom_domain, status: site.custom_domain_status });
    }}
    className="px-3 py-1.5 text-xs font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
  >
    {site.custom_domain ? 'Manage Domain' : 'Add Domain'}
  </button>
)}
```

Before the closing `</div>` of the main component, add the modal:
```jsx
{domainPanelSiteId && (
  <div
    className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    onClick={() => setDomainPanelSiteId(null)}
  >
    <div
      className="bg-white rounded-2xl max-w-md w-full p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-[#1a1a1a]">Custom Domain</p>
        <button onClick={() => setDomainPanelSiteId(null)} className="text-[#888] hover:text-[#cc0000]">✕</button>
      </div>
      <CustomDomainPanel
        siteId={domainPanelSiteId}
        initialDomain={domainPanelInitial?.domain}
        initialStatus={domainPanelInitial?.status || 'disconnected'}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardPage.jsx
git commit -m "feat: dashboard Manage Domain button + modal"
```

---

## Task 26: Cloudflare one-time setup runbook

**Files:**
- Create: `docs/superpowers/runbooks/cloudflare-saas-setup.md`

- [ ] **Step 1: Write runbook**

Create `docs/superpowers/runbooks/cloudflare-saas-setup.md`:
```markdown
# Cloudflare for SaaS — One-Time Setup

Do this once, by hand, before enabling the feature flag `VITE_CUSTOM_DOMAIN_ENABLED=true`.

## Prerequisites
- Cloudflare account on Free plan or higher.
- `autocaregeniushub.com` zone active in the account.
- `CLOUDFLARE_API_TOKEN` with permissions: `Zone → Custom Hostnames → Edit` and `DNS → Edit` on the zone.

## Step 1 — Create the fallback DNS record

In the dashboard, open the `autocaregeniushub.com` zone → DNS → Records → Add record:

- Type: `CNAME`
- Name: `fallback`
- Target: same target the existing `*.autocaregeniushub.com` Worker uses (check the existing wildcard record if unsure — often a `workers.dev` subdomain).
- Proxy status: **Proxied** (orange cloud).
- TTL: Auto.

Click Save.

## Step 2 — Set fallback origin

In the dashboard, navigate to `autocaregeniushub.com` → SSL/TLS → Custom Hostnames.

Under **Fallback Origin**, enter: `fallback.autocaregeniushub.com`. Click **Add Fallback Origin**.

Wait for the status to become Active (can take a few minutes).

## Step 3 — Record the Zone ID

In the zone overview right sidebar, copy the Zone ID. Set it as env var `CLOUDFLARE_ZONE_ID` in Netlify site settings.

## Step 4 — Smoke test

Run this curl against the Custom Hostnames API to confirm the token works:

```
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/custom_hostnames" \
  -H "Authorization: Bearer <CF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"hostname":"smoketest.example.com","ssl":{"method":"http","type":"dv"}}'
```

Expected: 200 with `"success": true`. Delete the smoke-test hostname via DELETE on the returned ID.

## Step 5 — Flip the feature flag

In Netlify → Site settings → Environment, set:
- `VITE_CUSTOM_DOMAIN_ENABLED=true`

Trigger a new deploy.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/cloudflare-saas-setup.md
git commit -m "docs: cloudflare saas one-time setup runbook"
```

---

## Task 27: Worker routing change spec (for separate repo)

**Files:**
- Create: `docs/superpowers/runbooks/worker-custom-hostname-routing.md`

- [ ] **Step 1: Write the spec**

Create `docs/superpowers/runbooks/worker-custom-hostname-routing.md`:
```markdown
# Worker Custom Hostname Routing — Change Spec

**This change lives in the Worker repo, not this one.** It is a prerequisite of the custom-domain feature.

## Current behavior

The Worker routes `{slug}.autocaregeniushub.com` to R2 key `{slug}/index.html`.

## Required new behavior

When the `Host` header does **not** end in `.autocaregeniushub.com`, treat it as a customer-owned custom hostname:

1. Strip any leading `www.` from the host to get the apex form.
2. Look up the site in Supabase: `SELECT slug FROM sites WHERE custom_domain = '{apex}' LIMIT 1`.
3. If found, serve `{slug}/index.html` from R2.
4. If not found, return `404` with a branded "Site not found" page.

## Caching

Wrap the Supabase lookup in Workers KV with a 60-second TTL. Cache key: `hostname:{apex}`. Cache value: `{slug}` or `null` for negative cache (shorter TTL, 10s).

## Environment variables the Worker needs

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or anon + a view if you prefer least-privilege)
- KV namespace binding `HOSTNAME_CACHE`

## Rough implementation sketch

```js
const host = request.headers.get('host').toLowerCase();
const isSubdomain = host.endsWith('.autocaregeniushub.com');
let slug;

if (isSubdomain) {
  slug = host.split('.')[0];
} else {
  const apex = host.replace(/^www\./, '');
  const cached = await env.HOSTNAME_CACHE.get(`hostname:${apex}`);
  if (cached) {
    slug = cached === '__NULL__' ? null : cached;
  } else {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/sites?custom_domain=eq.${apex}&select=slug&limit=1`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const rows = await res.json();
    slug = rows[0]?.slug || null;
    await env.HOSTNAME_CACHE.put(`hostname:${apex}`, slug || '__NULL__', { expirationTtl: slug ? 60 : 10 });
  }
}

if (!slug) return new Response(notFoundHtml, { status: 404, headers: { 'Content-Type': 'text/html' } });

return env.ASSETS_BUCKET.get(`${slug}/index.html`).then(obj => new Response(obj.body, { headers: { 'Content-Type': 'text/html' } }));
```

## Cache invalidation

When a site is disconnected or deleted, our `disconnect-domain` / `unpublish-site` functions should purge the KV key. Add a `purge-hostname-cache` function in this repo that calls the Workers KV API; call it from those two functions after DB updates. (If not feasible, accept 60-second stale time.)

## Testing

- Deploy to Worker staging/preview.
- Add a test custom hostname manually via Cloudflare API that points at a known site.
- `curl -H "Host: test.example.com" https://worker-url/` → returns that site's HTML.
- `curl -H "Host: not-in-db.com" https://worker-url/` → returns 404 page.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/worker-custom-hostname-routing.md
git commit -m "docs: spec for worker custom hostname routing change"
```

---

## Task 28: Full test sweep + final commit

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: all tests pass (domainUtils, stateSig, cloudflare, domainConnect, statusMachine server, statusMachine client — ~30 tests across 6 files).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors. Fix any.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: build succeeds; `dist/.well-known/domainconnect/v2/autocaregeniushub.com/settings.json` exists.

- [ ] **Step 4: Verify netlify.toml + function listing**

Run: `ls netlify/functions` — should include `connect-domain.js`, `domain-status.js`, `disconnect-domain.js`, `domain-sweep.js`, `publish-site.js`, `unpublish-site.js`, `generate-website.js`, `places-search.js`, plus `_shared/` dir.

- [ ] **Step 5: Commit any remaining changes**

```bash
git status
```
If anything uncommitted, inspect and commit or discard as appropriate.

---

## Task 29: Manual E2E test checklist (after deployment)

This is a checklist the human operator runs once the feature flag is flipped to `true` on production. Not a code task.

- [ ] Cloudflare one-time setup complete (Task 26 runbook).
- [ ] Worker changes deployed from the Worker repo (Task 27 spec).
- [ ] `VITE_CUSTOM_DOMAIN_ENABLED=true` in Netlify prod env.
- [ ] Site deployed.
- [ ] **GoDaddy flow**: create a test site, connect a throwaway GoDaddy domain, verify redirect → authorize → DNS applied → hostname active → SSL issued → site serves over HTTPS on the custom domain. Verify "domain live" Postmark email arrives.
- [ ] **Namecheap flow**: connect a Namecheap domain (no Domain Connect). Confirm CNAME instructions are shown. Add the records manually at Namecheap. Verify the panel transitions through pending_dns → active_dns → active_ssl. Verify site serves.
- [ ] **Disconnect**: disconnect the Namecheap domain. Verify the Cloudflare custom hostname is gone (`curl` the API to confirm) and Supabase columns cleared.
- [ ] **www-only input**: try entering `www.somebiz.com` in the panel. Confirm it's accepted and connects both apex + www.
- [ ] **Conflict test**: try connecting the same domain to a second site. Confirm a 409 error is surfaced.
- [ ] **Invalid input**: try `not a domain`. Confirm validation error.

---

## Spec coverage check

| Spec requirement | Implemented in task |
|------------------|----------------------|
| Supabase migration | Task 4 |
| Domain normalization + validation | Tasks 5, 6 |
| Cloudflare API client | Task 9 |
| Domain Connect discovery + apply URL | Task 10 |
| Auth + site ownership | Task 11 |
| `connect-domain` function | Task 12 |
| `domain-status` function | Task 13 |
| Status consolidation | Task 14 |
| `disconnect-domain` function | Task 15 |
| `unpublish-site` hostname cleanup | Task 16 |
| Domain Connect template | Task 17 |
| `/.well-known/*` exception + scheduled function config | Task 18 |
| Postmark email helper | Task 19 |
| `domain-sweep` scheduled SSL-live detection | Task 20 |
| Client-side status display helper | Task 21 |
| CustomDomainPanel UI | Task 22 |
| `/domain-connected` callback | Task 23 |
| Wire into StepExport | Task 24 |
| Wire into Dashboard (modal) | Task 25 |
| Cloudflare one-time setup runbook | Task 26 |
| Worker routing change spec | Task 27 |
| Test sweep + build | Task 28 |
| Manual E2E | Task 29 |

## Deferred / out of scope (from spec Non-goals)

- Domain search + purchase.
- Multiple domains per site.
- Paid gating (handled by `VITE_CUSTOM_DOMAIN_ENABLED` flag only, not billing).
- IDN/punycode domains.
- Reconciliation cron for orphan Cloudflare hostnames (can be added later).
