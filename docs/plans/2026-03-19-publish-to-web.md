# Publish to Web — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a one-click "Publish to Web" flow that deploys each client's HTML site to a live subdomain (e.g., `mikes-detailing.yourdomain.com`) via Netlify + Cloudflare DNS, with optional custom domain support.

**Architecture:** A new Netlify function (`publish-site.js`) orchestrates deployment: it pushes HTML to Netlify's Deploy API using the file-digest method, creates a CNAME in Cloudflare DNS for the clean subdomain, and saves the result to Supabase. The frontend adds a "Publish to Web" tab in the export step and shows published URLs in the dashboard.

**Tech Stack:** Node 20 native `fetch` + `crypto` (no new packages), Netlify Deploy API, Cloudflare DNS API v4, Supabase `sites` table, React (existing patterns)

**Domain note:** The hub domain (e.g., `autocaregeniushub.com`) is not yet registered. Use the env var `PUBLISH_DOMAIN` throughout — set it once the domain is chosen. All code references this var, so changing the domain requires only a single env var update.

---

## Phase 0: One-time Setup (human steps, not code)

Before any code will work end-to-end:

1. Register a domain through [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) — DNS is managed by Cloudflare automatically
2. In Netlify dashboard → **User Settings → Applications → Personal access tokens** → create a token, copy it
3. In Cloudflare dashboard → **My Profile → API Tokens → Create Token** → use "Edit zone DNS" template, scope to your domain → copy token
4. In Cloudflare dashboard → **Websites → your domain → Overview** → copy the **Zone ID** (right sidebar)
5. In Netlify dashboard → **Site → Environment variables** → add:
   - `NETLIFY_ACCESS_TOKEN` = your Netlify personal token
   - `CLOUDFLARE_API_TOKEN` = your Cloudflare token
   - `CLOUDFLARE_ZONE_ID` = your zone ID
   - `PUBLISH_DOMAIN` = your domain (e.g., `autocaregeniushub.com`)

---

## Task 1: Database Migration — Add publishing columns to `sites`

**Files:**
- Supabase SQL migration (run via Supabase dashboard > SQL editor, or MCP tool)

**Step 1: Run this SQL in Supabase**

```sql
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS published_url TEXT,
  ADD COLUMN IF NOT EXISTS netlify_site_id TEXT,
  ADD COLUMN IF NOT EXISTS netlify_site_name TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Index for slug lookups (uniqueness check)
CREATE INDEX IF NOT EXISTS sites_slug_idx ON sites (slug);
```

**Step 2: Verify** — In Supabase table editor, confirm `sites` has the 5 new columns.

**Step 3: Commit**
```bash
git add -A
git commit -m "feat: add publishing columns to sites table (migration notes)"
```

---

## Task 2: Slug Utility — `src/lib/publishUtils.js`

**Files:**
- Create: `src/lib/publishUtils.js`

**Step 1: Write the file**

```js
/**
 * Generate a URL-safe slug from a business name.
 * Result is used as the subdomain: slug.yourdomain.com
 */
export function generateSlug(businessName) {
  return businessName
    .toLowerCase()
    .replace(/[''']/g, '')          // strip apostrophes
    .replace(/[^a-z0-9]+/g, '-')   // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '')       // trim leading/trailing dashes
    .slice(0, 40);                  // max 40 chars for readability
}

/**
 * Append a short unique suffix to guarantee uniqueness.
 * Used for the Netlify internal site name (must be globally unique).
 * siteId is the Supabase row UUID.
 */
export function netlifyName(slug, siteId) {
  const suffix = siteId.replace(/-/g, '').slice(0, 6);
  return `${slug}-${suffix}`;
}
```

**Step 2: Verify manually** — In browser console or Node REPL:
```js
import { generateSlug, netlifyName } from './src/lib/publishUtils.js'
generateSlug("Mike's Auto Detailing")  // → "mikes-auto-detailing"
netlifyName("mikes-auto-detailing", "a1b2c3d4-e5f6-...")  // → "mikes-auto-detailing-a1b2c3"
```

**Step 3: Commit**
```bash
git add src/lib/publishUtils.js
git commit -m "feat: add slug generation utility for site publishing"
```

---

## Task 3: Netlify Function — `netlify/functions/publish-site.js`

**Files:**
- Create: `netlify/functions/publish-site.js`

This function:
1. Validates auth via Supabase JWT
2. Deploys HTML to Netlify using the file-digest API (no zip needed)
3. Creates a Cloudflare CNAME: `slug.PUBLISH_DOMAIN → netlify-site-name.netlify.app`
4. Optionally registers a client custom domain on the Netlify site
5. Updates the Supabase `sites` row with publishing metadata

**Step 1: Write the function**

```js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE = process.env.CLOUDFLARE_ZONE_ID;
const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || 'yourdomain.com';

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

  // --- Auth ---
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // use service role for server-side writes
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid session' }) };
  }

  // --- Parse body ---
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId, htmlContent, slug, netlifyName, customDomain } = body;
  if (!siteId || !htmlContent || !slug || !netlifyName) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Verify site belongs to this user
  const { data: siteRow, error: siteErr } = await supabase
    .from('sites').select('id, netlify_site_id').eq('id', siteId).eq('user_id', user.id).single();
  if (siteErr || !siteRow) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Site not found' }) };
  }

  try {
    // --- Step 1: Create or reuse Netlify site ---
    let netlifySiteId = siteRow.netlify_site_id;
    let netlifySiteName;

    if (!netlifySiteId) {
      const createRes = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: netlifyName }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(`Netlify site creation failed: ${err.message || createRes.status}`);
      }
      const site = await createRes.json();
      netlifySiteId = site.id;
      netlifySiteName = site.name;
    } else {
      // Fetch existing site name
      const siteRes = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}`, {
        headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}` },
      });
      const site = await siteRes.json();
      netlifySiteName = site.name;
    }

    // --- Step 2: Deploy HTML via file-digest method ---
    const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
    const sha1 = crypto.createHash('sha1').update(htmlBuffer).digest('hex');

    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}/deploys`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { '/index.html': sha1 } }),
    });
    if (!deployRes.ok) throw new Error(`Netlify deploy init failed: ${deployRes.status}`);
    const deploy = await deployRes.json();

    // Upload the HTML file
    const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: htmlBuffer,
    });
    if (!uploadRes.ok) throw new Error(`Netlify file upload failed: ${uploadRes.status}`);

    // --- Step 3: Create Cloudflare CNAME (skip if already exists) ---
    const cnameTarget = `${netlifySiteName}.netlify.app`;
    const cfListRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?type=CNAME&name=${slug}.${PUBLISH_DOMAIN}`,
      { headers: { 'Authorization': `Bearer ${CF_TOKEN}` } }
    );
    const cfList = await cfListRes.json();
    const existingRecord = cfList.result?.[0];

    if (!existingRecord) {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CNAME',
          name: slug,               // e.g., "mikes-detailing" → full: mikes-detailing.yourdomain.com
          content: cnameTarget,     // e.g., mikes-detailing-a1b2c3.netlify.app
          proxied: false,           // must be false so Netlify can provision SSL
          ttl: 1,                   // 1 = automatic
        }),
      });
      if (!cfRes.ok) {
        const cfErr = await cfRes.json();
        console.error('Cloudflare DNS error:', cfErr);
        // Non-fatal: site is still live at netlify URL
      }
    }

    const publishedUrl = `https://${slug}.${PUBLISH_DOMAIN}`;
    const netlifyUrl = `https://${cnameTarget}`;

    // --- Step 4: Optional custom domain ---
    let cnameInstructions = null;
    if (customDomain) {
      const patchRes = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_domain: customDomain }),
      });
      if (patchRes.ok) {
        cnameInstructions = {
          type: 'CNAME',
          name: customDomain.startsWith('www.') ? 'www' : '@',
          value: cnameTarget,
        };
      }
    }

    // --- Step 5: Update Supabase ---
    await supabase.from('sites').update({
      slug,
      published_url: publishedUrl,
      netlify_site_id: netlifySiteId,
      netlify_site_name: netlifySiteName,
      custom_domain: customDomain || null,
    }).eq('id', siteId);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ publishedUrl, netlifyUrl, cnameInstructions }),
    };

  } catch (err) {
    console.error('publish-site error:', err);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: err.message || 'Publish failed' }) };
  }
};
```

**Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to Netlify env vars** — get it from Supabase dashboard → Project Settings → API → service_role key.

**Step 3: Commit**
```bash
git add netlify/functions/publish-site.js
git commit -m "feat: add publish-site netlify function (Netlify deploy + Cloudflare DNS)"
```

---

## Task 4: Frontend API Helper — `src/lib/publishSite.js`

**Files:**
- Create: `src/lib/publishSite.js`

**Step 1: Write the helper**

```js
import { generateSlug, netlifyName } from './publishUtils.js';
import { exportHtmlString } from './exportHtml.js';

/**
 * Publish a site to the web via the publish-site Netlify function.
 * Returns { publishedUrl, netlifyUrl, cnameInstructions }
 */
export async function publishSite({ siteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, customDomain, session }) {
  const slug = generateSlug(businessInfo.businessName);
  const siteName = netlifyName(slug, siteId);

  // Generate the HTML string (reuse existing export logic)
  const htmlContent = await exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds || []);

  const res = await fetch('/.netlify/functions/publish-site', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ siteId, htmlContent, slug, netlifyName: siteName, customDomain: customDomain || null }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Publish failed');
  }

  return res.json();
}
```

**Step 2: Add `exportHtmlString` to `src/lib/exportHtml.js`**

Currently `exportHtml` triggers a browser download. We need a version that returns the HTML string instead.

Modify `src/lib/exportHtml.js` — find the function that builds the HTML string and export it separately:

```js
// Add this export alongside the existing exportHtml function:
export async function exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds) {
  // Same logic as exportHtml but return the string instead of triggering download
  // (copy the HTML-building code, remove the download trigger)
}
```

Look at `exportHtml.js` first to understand how the HTML is assembled — refactor so the string-building is a shared helper both `exportHtml` and `exportHtmlString` call.

**Step 3: Commit**
```bash
git add src/lib/publishSite.js src/lib/exportHtml.js
git commit -m "feat: add publishSite helper, extract exportHtmlString from exportHtml"
```

---

## Task 5: Frontend — Publish UI in StepExport

**Files:**
- Modify: `src/components/wizard/StepExport.jsx`

**Step 1: Add publish state + handler**

At the top of `StepExport`, add new state alongside existing:
```js
const [publishTab, setPublishTab] = useState('download'); // 'download' | 'publish'
const [publishing, setPublishing] = useState(false);
const [published, setPublished] = useState(null); // { publishedUrl, netlifyUrl, cnameInstructions }
const [publishError, setPublishError] = useState(null);
const [customDomain, setCustomDomain] = useState('');
const [siteId, setSiteId] = useState(null); // track saved site ID for publish
```

Update `handleDownload` to capture the Supabase-inserted row ID:
```js
// After the supabase.from('sites').insert(...), capture the returned id:
const { data: savedSite, error: saveError } = await supabase.from('sites').insert({...}).select('id').single();
if (savedSite) setSiteId(savedSite.id);
```

Add publish handler:
```js
const handlePublish = async () => {
  if (!siteId) {
    // Auto-save first if not yet saved
    // (call the same insert logic, capture siteId)
  }
  setPublishing(true);
  setPublishError(null);
  try {
    const result = await publishSite({
      siteId, businessInfo, generatedCopy, templateId, templateMeta,
      images, selectedWidgetIds, customDomain: customDomain || null, session,
    });
    setPublished(result);
  } catch (err) {
    setPublishError(err.message);
  } finally {
    setPublishing(false);
  }
};
```

**Step 2: Update the JSX**

Replace the download button section with a two-tab layout:

```jsx
{/* Tab switcher */}
<div className="flex border border-black/[0.07] rounded-xl p-1 mb-5 gap-1">
  <button
    onClick={() => setPublishTab('download')}
    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
      ${publishTab === 'download' ? 'bg-[#1a1a1a] text-white' : 'text-[#555] hover:text-[#1a1a1a]'}`}
  >
    Download HTML
  </button>
  <button
    onClick={() => setPublishTab('publish')}
    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
      ${publishTab === 'publish' ? 'bg-[#1a1a1a] text-white' : 'text-[#555] hover:text-[#1a1a1a]'}`}
  >
    Publish to Web
  </button>
</div>

{publishTab === 'download' && (
  // ... existing download button and downloaded state JSX (unchanged)
)}

{publishTab === 'publish' && (
  <div>
    {!published ? (
      <>
        <div className="border border-black/[0.07] rounded-xl p-4 mb-4 bg-[#faf9f7] text-sm">
          <p className="font-semibold text-[#1a1a1a] mb-1">Your site will be live at:</p>
          <p className="text-[#888] font-mono text-xs break-all">
            {generateSlug(businessInfo.businessName)}.{PUBLISH_DOMAIN}
          </p>
        </div>

        <button
          onClick={handlePublish}
          disabled={publishing}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] transition-all mb-4
            ${publishing ? 'bg-[#f2f0ec] text-[#888] cursor-not-allowed' : 'bg-[#cc0000] hover:bg-[#aa0000] text-white'}`}
        >
          {publishing ? 'Publishing...' : 'Publish Site'}
        </button>

        {/* Optional custom domain */}
        <div className="border-t border-black/[0.05] pt-4">
          <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Optional: Use your own domain</p>
          <input
            type="text"
            placeholder="www.mybusiness.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            className="w-full border border-black/[0.10] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#cc0000]/50"
          />
          <p className="text-xs text-[#999] mt-1.5">You'll get CNAME instructions after publishing.</p>
        </div>
      </>
    ) : (
      // Published state
      <div>
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 mb-4">
          <p className="font-semibold text-green-800 mb-1">Your site is live!</p>
          <a
            href={published.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-700 underline break-all"
          >
            {published.publishedUrl}
          </a>
          <p className="text-xs text-green-600 mt-1">DNS may take 1–5 minutes to propagate globally.</p>
        </div>

        <button
          onClick={() => navigator.clipboard.writeText(published.publishedUrl)}
          className="w-full py-2.5 px-4 border border-black/[0.07] rounded-xl text-sm font-medium hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors mb-3"
        >
          Copy Link
        </button>

        {published.cnameInstructions && (
          <div className="border border-black/[0.07] rounded-xl p-4 text-sm bg-[#faf9f7]">
            <p className="font-semibold text-[#1a1a1a] mb-2">Add this DNS record at your registrar:</p>
            <div className="font-mono text-xs space-y-1 text-[#555]">
              <p><span className="font-semibold">Type:</span> CNAME</p>
              <p><span className="font-semibold">Name:</span> {published.cnameInstructions.name}</p>
              <p><span className="font-semibold">Value:</span> {published.cnameInstructions.value}</p>
            </div>
          </div>
        )}
      </div>
    )}

    {publishError && (
      <div className="border border-[#cc0000]/20 rounded-xl p-4 mt-3 text-sm text-[#cc0000] bg-[#cc0000]/5">
        {publishError}
      </div>
    )}
  </div>
)}
```

Add imports at top of StepExport.jsx:
```js
import { publishSite } from '../../lib/publishSite.js';
import { generateSlug } from '../../lib/publishUtils.js';
const PUBLISH_DOMAIN = import.meta.env.VITE_PUBLISH_DOMAIN || 'yourdomain.com';
```

Add `VITE_PUBLISH_DOMAIN` to `.env.local`:
```
VITE_PUBLISH_DOMAIN=yourdomain.com
```

**Step 3: Commit**
```bash
git add src/components/wizard/StepExport.jsx src/lib/publishSite.js .env.local
git commit -m "feat: add publish-to-web tab in export step"
```

---

## Task 6: Dashboard — Show Published URLs + Republish

**Files:**
- Modify: `src/components/dashboard/DashboardPage.jsx`

**Step 1: Update site card to show published URL**

In the site card JSX, add below the existing business name / date info:
```jsx
{site.published_url && (
  <a
    href={site.published_url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-xs text-[#cc0000] underline mt-0.5 block truncate max-w-[260px]"
  >
    {site.published_url.replace('https://', '')}
  </a>
)}
```

**Step 2: Add "Republish" button** alongside existing Re-export button:
```jsx
{site.published_url && (
  <button
    onClick={() => handleRepublish(site)}
    className="px-3 py-1.5 text-xs font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
  >
    Republish
  </button>
)}
```

**Step 3: Add `handleRepublish` function:**
```js
const handleRepublish = async (site) => {
  if (!confirm(`Republish ${site.business_info?.businessName}?`)) return;
  try {
    const { exportHtmlString } = await import('../../lib/exportHtml.js');
    const { publishSite } = await import('../../lib/publishSite.js');
    const { TEMPLATES } = await import('../../data/templates.js');
    const templateMeta = TEMPLATES[site.template_id];
    await publishSite({
      siteId: site.id,
      businessInfo: site.business_info,
      generatedCopy: site.generated_content,
      templateId: site.template_id,
      templateMeta: { ...templateMeta, colors: templateMeta?.colors || {} },
      images: {},
      selectedWidgetIds: site.widget_config_ids || [],
      customDomain: site.custom_domain || null,
      session,
    });
    // Refresh to show updated URL
    setSites((prev) => prev.map((s) => s.id === site.id ? { ...s, published_url: site.published_url } : s));
    alert('Site republished!');
  } catch (err) {
    alert(`Republish failed: ${err.message}`);
  }
};
```

**Step 4: Commit**
```bash
git add src/components/dashboard/DashboardPage.jsx
git commit -m "feat: show published URL and republish button in dashboard"
```

---

## Verification

### Local dev (limited — functions need real API keys)
```bash
npm run dev
# Open http://localhost:5173
# Go through wizard → Export step → "Publish to Web" tab
# Verify tab renders and slug preview shows
```

### Full end-to-end (requires Phase 0 setup)
```bash
netlify dev
# Open http://localhost:8890
# Go through wizard → Export → Publish to Web
# Click "Publish Site" → wait ~10s
# Verify:
#   1. Published URL shown: mikes-detailing.yourdomain.com
#   2. Netlify dashboard shows new site deploy
#   3. Cloudflare DNS shows new CNAME record
#   4. Supabase sites row has published_url populated
#   5. After 1-5 min DNS propagation: URL resolves in browser
#   6. Dashboard shows site URL with link
#   7. Republish works: updates deploy, same URL
```

### Custom domain test
```
1. Enter www.testbusiness.com in custom domain field
2. After publish, verify CNAME instructions shown correctly
3. Verify Netlify site shows custom domain pending
```

### Edge cases
- Business name with apostrophes/special chars → slug strips them cleanly
- Republish existing site → reuses `netlify_site_id`, no new Netlify site created
- Cloudflare CNAME already exists (republish) → function skips creation, no error
- Missing env vars → function returns 500 with clear error message

---

## Environment Variables Summary

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `NETLIFY_ACCESS_TOKEN` | Netlify env vars | Deploy API auth |
| `CLOUDFLARE_API_TOKEN` | Netlify env vars | DNS record creation |
| `CLOUDFLARE_ZONE_ID` | Netlify env vars | Which domain's DNS to update |
| `PUBLISH_DOMAIN` | Netlify env vars | Hub domain (e.g., autocaregeniushub.com) |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify env vars | Server-side Supabase writes |
| `VITE_PUBLISH_DOMAIN` | `.env.local` + Netlify | Frontend domain display |
