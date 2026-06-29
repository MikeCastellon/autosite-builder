# Image Storage Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store site images as files in Supabase Storage and keep only their public URLs in `generated_content._images`, so the publish HTML payload stays under Netlify's ~6 MB limit.

**Architecture:** A new `src/lib/imageUpload.js` isolates pure helpers (path building, legacy-image partitioning) from browser-only work (canvas downscale + Supabase Storage upload). The wizard's image slots upload on file-select and store the returned URL. Opening an existing draft auto-migrates any base64 entries to URLs. A one-off Node script backfills the Zwitch Wash draft immediately. Templates already render whatever string is in `src`, so they are untouched.

**Tech Stack:** React 19, Vite, Supabase JS (`storage`), Vitest (node env, explicit imports), `sharp` (dev-only, backfill script).

---

## File Structure

- **Create** `src/lib/imageUpload.js` — pure helpers + browser upload/migration functions.
- **Create** `src/lib/imageUpload.test.js` — unit tests for the pure helpers and migration orchestration (node env, injected upload fn).
- **Create** `scripts/backfill-site-images.mjs` — one-off service-role backfill.
- **Create** `supabase/migrations/<ts>_site_images_bucket.sql` — bucket + RLS policies (applied via Supabase MCP `apply_migration`).
- **Modify** `src/components/preview/ContentEditor.jsx` — upload on select in `ImageSlot` + inline product handler; thread `siteId`/`uploadKey`; uploading + error UI.
- **Modify** `src/components/preview/WebsitePreview.jsx` — accept and pass `siteId` to `ContentEditor`.
- **Modify** `src/App.jsx` — pass `siteId` to `WebsitePreview`; auto-migrate legacy `_images` in `handleEditSite`.

---

## Task 1: Pure helpers in `imageUpload.js` (path + partition)

**Files:**
- Create: `src/lib/imageUpload.js`
- Test: `src/lib/imageUpload.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/imageUpload.test.js
import { describe, it, expect } from 'vitest';
import { isDataUrl, buildImagePath, partitionLegacyImages } from './imageUpload.js';

describe('isDataUrl', () => {
  it('detects base64 data URLs and rejects http URLs / empties', () => {
    expect(isDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isDataUrl('https://x.supabase.co/a.jpg')).toBe(false);
    expect(isDataUrl('')).toBe(false);
    expect(isDataUrl(null)).toBe(false);
    expect(isDataUrl(undefined)).toBe(false);
  });
});

describe('buildImagePath', () => {
  it('namespaces by siteId and includes the key + a suffix, ending .jpg', () => {
    const p = buildImagePath('site-123', 'hero', 'abc123');
    expect(p).toBe('site-123/hero-abc123.jpg');
  });
});

describe('partitionLegacyImages', () => {
  it('separates base64 entries from already-migrated URL entries', () => {
    const images = {
      hero: 'data:image/jpeg;base64,AAAA',
      logo: 'https://x.supabase.co/logo.jpg',
      about: 'data:image/png;base64,BBBB',
      empty: '',
    };
    const { toMigrate, keep } = partitionLegacyImages(images);
    expect(toMigrate).toEqual(['hero', 'about']);
    expect(keep).toEqual({ logo: 'https://x.supabase.co/logo.jpg', empty: '' });
  });

  it('returns empty results for null/empty input', () => {
    expect(partitionLegacyImages(null)).toEqual({ toMigrate: [], keep: {} });
    expect(partitionLegacyImages({})).toEqual({ toMigrate: [], keep: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/imageUpload.test.js`
Expected: FAIL — `imageUpload.js` does not export these (module/exports not found).

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/imageUpload.js
import { supabase } from './supabase.js';

const BUCKET = 'site-images';
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image');
}

export function buildImagePath(siteId, imageKey, suffix) {
  return `${siteId}/${imageKey}-${suffix}.jpg`;
}

// Split an images map into base64 keys needing migration vs entries to keep as-is.
export function partitionLegacyImages(images) {
  const toMigrate = [];
  const keep = {};
  for (const [key, value] of Object.entries(images || {})) {
    if (isDataUrl(value)) toMigrate.push(key);
    else keep[key] = value;
  }
  return { toMigrate, keep };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/imageUpload.test.js`
Expected: PASS (3 describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageUpload.js src/lib/imageUpload.test.js
git commit -m "feat(images): pure helpers for storage path + legacy partition"
```

---

## Task 2: Browser upload + migration orchestration

**Files:**
- Modify: `src/lib/imageUpload.js`
- Test: `src/lib/imageUpload.test.js`

`downscaleToJpegBlob` and `uploadSiteImage` are browser-only (canvas + Supabase) and are NOT unit-tested under the node env. `migrateLegacyImages` is tested with an injected upload fn so it stays pure-ish and node-runnable.

- [ ] **Step 1: Write the failing test**

```js
// append to src/lib/imageUpload.test.js
import { migrateLegacyImages } from './imageUpload.js';

describe('migrateLegacyImages', () => {
  it('uploads only base64 entries and returns an all-resolved map', async () => {
    const images = {
      hero: 'data:image/jpeg;base64,AAAA',
      logo: 'https://x.supabase.co/logo.jpg',
    };
    const calls = [];
    const fakeUpload = async (value, { siteId, imageKey }) => {
      calls.push({ value, siteId, imageKey });
      return `https://x.supabase.co/${siteId}/${imageKey}.jpg`;
    };
    const result = await migrateLegacyImages(images, 'site-9', { uploadFn: fakeUpload });
    expect(result.migrated).toBe(true);
    expect(result.images).toEqual({
      hero: 'https://x.supabase.co/site-9/hero.jpg',
      logo: 'https://x.supabase.co/logo.jpg',
    });
    expect(calls).toEqual([{ value: 'data:image/jpeg;base64,AAAA', siteId: 'site-9', imageKey: 'hero' }]);
  });

  it('keeps base64 for a failed upload and still reports migrated for the rest', async () => {
    const images = { hero: 'data:image/jpeg;base64,AAAA', about: 'data:image/jpeg;base64,BBBB' };
    const fakeUpload = async (value, { imageKey }) => {
      if (imageKey === 'about') throw new Error('boom');
      return 'https://x/hero.jpg';
    };
    const result = await migrateLegacyImages(images, 'site-9', { uploadFn: fakeUpload });
    expect(result.migrated).toBe(true);
    expect(result.images.hero).toBe('https://x/hero.jpg');
    expect(result.images.about).toBe('data:image/jpeg;base64,BBBB');
  });

  it('returns migrated:false when nothing needs migration', async () => {
    const images = { logo: 'https://x/logo.jpg' };
    const result = await migrateLegacyImages(images, 'site-9', { uploadFn: async () => 'x' });
    expect(result.migrated).toBe(false);
    expect(result.images).toEqual(images);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/imageUpload.test.js`
Expected: FAIL — `migrateLegacyImages` is not exported.

- [ ] **Step 3: Write minimal implementation**

```js
// append to src/lib/imageUpload.js

// Browser-only: load any image source into a canvas, cap the longest edge,
// and re-encode as a JPEG Blob. Accepts a File or a data-URL string.
async function downscaleToJpegBlob(source) {
  const dataUrl = typeof source === 'string'
    ? source
    : await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(source);
      });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encode failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

// Short non-cryptographic suffix to bust caches and avoid collisions on re-upload.
function shortSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

// Browser-only: downscale -> upload to Supabase Storage -> return public URL.
export async function uploadSiteImage(source, { siteId, imageKey }) {
  const blob = await downscaleToJpegBlob(source);
  const path = buildImagePath(siteId, imageKey, shortSuffix());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw new Error(error.message || 'Image upload failed');
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Convert any base64 entries in an images map to storage URLs. Best-effort:
// a failed image keeps its base64 value. `uploadFn` is injectable for tests.
export async function migrateLegacyImages(images, siteId, { uploadFn = uploadSiteImage } = {}) {
  const { toMigrate, keep } = partitionLegacyImages(images);
  if (toMigrate.length === 0) return { migrated: false, images: images || {} };

  const result = { ...keep };
  for (const key of toMigrate) {
    try {
      result[key] = await uploadFn(images[key], { siteId, imageKey: key });
    } catch {
      result[key] = images[key]; // keep base64; will retry next open
    }
  }
  return { migrated: true, images: result };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/imageUpload.test.js`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageUpload.js src/lib/imageUpload.test.js
git commit -m "feat(images): downscale+upload to Supabase Storage and legacy migration"
```

---

## Task 3: Create `site-images` bucket + RLS policies

**Files:**
- Create: `supabase/migrations/<timestamp>_site_images_bucket.sql` (for repo record; apply via MCP)

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/<timestamp>_site_images_bucket.sql
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

-- Public read (bucket is public, but make the SELECT policy explicit).
create policy "site_images_public_read"
on storage.objects for select
using (bucket_id = 'site-images');

-- Write: first path segment must be a site the caller owns, or super admin.
create policy "site_images_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'site-images'
  and (
    is_super_admin(auth.uid())
    or exists (
      select 1 from public.sites s
      where s.id = ((storage.foldername(name))[1])::uuid
        and s.user_id = auth.uid()
    )
  )
);

create policy "site_images_owner_update"
on storage.objects for update
using (
  bucket_id = 'site-images'
  and (
    is_super_admin(auth.uid())
    or exists (
      select 1 from public.sites s
      where s.id = ((storage.foldername(name))[1])::uuid
        and s.user_id = auth.uid()
    )
  )
);

create policy "site_images_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'site-images'
  and (
    is_super_admin(auth.uid())
    or exists (
      select 1 from public.sites s
      where s.id = ((storage.foldername(name))[1])::uuid
        and s.user_id = auth.uid()
    )
  )
);
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `apply_migration` (project `ktnouhjikmlxlbxcxyif`, name `site_images_bucket`) with the SQL above.
Expected: success.

- [ ] **Step 3: Verify**

Run `execute_sql`: `select id, public from storage.buckets where id = 'site-images';`
Expected: one row, `public = true`. And `select policyname from pg_policies where tablename='objects' and policyname like 'site_images%';` returns the 4 policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(images): site-images public bucket with owner-scoped write policies"
```

---

## Task 4: Thread `siteId` into ContentEditor and upload on select

**Files:**
- Modify: `src/components/preview/WebsitePreview.jsx:12` (props), `:64-81` (pass `siteId`)
- Modify: `src/components/preview/ContentEditor.jsx` (`ImageSlot`, `GallerySlots`, slot call sites, product handler, props)
- Modify: `src/App.jsx:776` (`<WebsitePreview ... siteId={siteId} />`)

No new test (UI wiring); covered by Task 2 unit tests + manual verify in Task 6.

- [ ] **Step 1: Pass `siteId` from App to WebsitePreview**

In `src/App.jsx`, add to the `<WebsitePreview ...>` props (near line 776):

```jsx
        siteId={siteId}
```

- [ ] **Step 2: Accept and forward `siteId` in WebsitePreview**

In `src/components/preview/WebsitePreview.jsx`, add `siteId` to the destructured props (line 12), and pass it to `<ContentEditor>` (after `templateId={templateId}` near line 71):

```jsx
        siteId={siteId}
```

- [ ] **Step 3: Accept `siteId` in ContentEditor and thread to slots**

In `src/components/preview/ContentEditor.jsx`, add `siteId` to the `ContentEditor` props destructure (line 394). Update `GallerySlots` to accept and forward `siteId`:

```jsx
function GallerySlots({ images, setImage, siteId }) {
```
and on each `<ImageSlot ... />` inside it add `siteId={siteId} uploadKey={`gallery${i}`}`. Where `<GallerySlots images=... setImage=... />` is rendered, add `siteId={siteId}`.

For every direct `<ImageSlot .../>` in `ContentEditor` (hero, logo, about, `shade${i}`), add `siteId={siteId}` and an `uploadKey` matching its image key, e.g.:

```jsx
<ImageSlot label="Hero Background" value={images?.hero} onChange={(v) => setImage('hero', v)} siteId={siteId} uploadKey="hero" />
<ImageSlot label="Business Logo" value={images?.logo} onChange={(v) => setImage('logo', v)} siteId={siteId} uploadKey="logo" />
<ImageSlot label="About Photo" value={images?.about} onChange={(v) => setImage('about', v)} siteId={siteId} uploadKey="about" />
<ImageSlot label={`Shade ${i + 1} Photo`} value={images?.[`shade${i}`]} onChange={(v) => setImage(`shade${i}`, v)} siteId={siteId} uploadKey={`shade${i}`} />
```

- [ ] **Step 4: Upload-on-select in `ImageSlot`**

Replace the `ImageSlot` body (`ContentEditor.jsx:289-326`) with an uploading state + error and the storage upload:

```jsx
import { uploadSiteImage } from '../../lib/imageUpload.js'; // add near top imports

function ImageSlot({ label, value, onChange, siteId, uploadKey }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const url = await uploadSiteImage(file, { siteId, imageKey: uploadKey });
      onChange(url);
    } catch (ex) {
      setErr(ex.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <label className="block cursor-pointer">
        {value ? (
          <div className="relative group rounded-lg overflow-hidden border border-gray-200">
            <img src={value} alt={label} className="w-full h-28 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-[12px] font-medium">{uploading ? 'Uploading…' : 'Change Image'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition text-gray-400 hover:text-gray-600">
            {uploading ? (
              <span className="text-[12px]">Uploading…</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mb-1">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[12px]">Upload {label}</span>
              </>
            )}
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleFile} className="sr-only" disabled={uploading} />
      </label>
      {err && <p className="mt-1 text-[11px] text-red-500">{err}</p>}
      {value && !uploading && (
        <button onClick={() => onChange(null)} className="mt-1 text-[11px] text-red-400 hover:text-red-600 transition">
          Remove
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Upload-on-select for the inline product image handler**

In `ContentEditor.jsx` (~937), replace the product image `onChange` FileReader block with an upload. The product loop has index `i`; use a stable key `product${i}`:

```jsx
<input type="file" accept="image/*" onChange={async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const url = await uploadSiteImage(file, { siteId, imageKey: `product${i}` });
    updateProduct(i, 'image', url);
  } catch (ex) {
    // surface via existing product UI if present; otherwise no-op alert
    console.error('Product image upload failed:', ex.message);
  } finally {
    e.target.value = '';
  }
}} className="sr-only" />
```

- [ ] **Step 6: Build to verify no syntax/lint breakage**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/preview/WebsitePreview.jsx src/components/preview/ContentEditor.jsx
git commit -m "feat(images): upload editor images to storage on select"
```

---

## Task 5: Auto-migrate legacy `_images` on opening a draft

**Files:**
- Modify: `src/App.jsx:370-404` (`handleEditSite`)

- [ ] **Step 1: Add migration after images are set**

In `handleEditSite`, after `setImages(siteImages)` (line 403), add a best-effort migration that uploads any base64 entries and persists URLs:

```jsx
    // Heal legacy base64 images: upload to storage, rewrite _images to URLs.
    // Best-effort and non-blocking so the editor opens immediately.
    (async () => {
      try {
        const { migrateLegacyImages } = await import('../lib/imageUpload.js');
        const { migrated, images: fixed } = await migrateLegacyImages(siteImages, site.id);
        if (migrated) {
          setImages(fixed);
          autoSave({ siteId: site.id, images: fixed });
        }
      } catch (e) { /* leave base64 in place; retry next open */ }
    })();
```

Note: confirm the relative import path resolves from `src/App.jsx` (it does: `../lib/imageUpload.js`). `autoSave` is already defined in App and persists `images` (see `App.jsx:137-153`).

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(images): auto-migrate legacy base64 images to storage on edit"
```

---

## Task 6: One-off backfill of the Zwitch Wash draft

**Files:**
- Create: `scripts/backfill-site-images.mjs`

- [ ] **Step 1: Write the backfill script**

```js
// scripts/backfill-site-images.mjs
// Usage: node scripts/backfill-site-images.mjs --site <id> [--dry]
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env/.env.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'site-images';
const DEFAULT_SITE = '216f44df-0fd2-4d43-a64f-6e72bd7487f3'; // Zwitch Wash
const args = process.argv.slice(2);
const siteId = args.includes('--site') ? args[args.indexOf('--site') + 1] : DEFAULT_SITE;
const dry = args.includes('--dry');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(url, key);

function isDataUrl(v) { return typeof v === 'string' && v.startsWith('data:image'); }

const { data: site, error } = await supabase.from('sites').select('id, generated_content').eq('id', siteId).single();
if (error) { console.error(error); process.exit(1); }

const gc = site.generated_content || {};
const images = gc._images || {};
const out = { ...images };
let changed = 0;

for (const [imageKey, value] of Object.entries(images)) {
  if (!isDataUrl(value)) continue;
  const b64 = value.split(',')[1];
  const input = Buffer.from(b64, 'base64');
  const jpeg = await sharp(input).resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const path = `${siteId}/${imageKey}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  console.log(`${imageKey}: ${(input.length/1024/1024).toFixed(2)}MB -> ${(jpeg.length/1024/1024).toFixed(2)}MB  ${path}`);
  if (dry) { changed++; continue; }
  const up = await supabase.storage.from(BUCKET).upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' });
  if (up.error) { console.error(`upload ${imageKey} failed:`, up.error.message); continue; }
  out[imageKey] = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  changed++;
}

if (!dry && changed > 0) {
  const newGc = { ...gc, _images: out };
  const { error: upErr } = await supabase.from('sites').update({ generated_content: newGc }).eq('id', siteId);
  if (upErr) { console.error('row update failed:', upErr); process.exit(1); }
}
console.log(`${dry ? '[dry] would convert' : 'converted'} ${changed} image(s).`);
```

- [ ] **Step 2: Ensure deps for the script**

Run: `npm i -D sharp dotenv`
Expected: installs (sharp/dotenv are dev/script-only, not imported by the app bundle).

- [ ] **Step 3: Dry run**

Run: `node scripts/backfill-site-images.mjs --dry`
Expected: lists ~15 images with before/after sizes; "[dry] would convert 15 image(s)."

- [ ] **Step 4: Real run**

Run: `node scripts/backfill-site-images.mjs`
Expected: "converted 15 image(s)."

- [ ] **Step 5: Verify row shrank**

Via Supabase MCP `execute_sql`:
```sql
select length(generated_content::text) as gc_len,
       (generated_content::text like '%data:image%') as has_b64
from sites where id = '216f44df-0fd2-4d43-a64f-6e72bd7487f3';
```
Expected: `gc_len` in the low KB range, `has_b64 = false`.

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-site-images.mjs package.json package-lock.json
git commit -m "chore(images): one-off backfill script for legacy base64 drafts"
```

---

## Task 7: End-to-end verification

**Files:** none (manual + DB checks)

- [ ] **Step 1: Full test + build**

Run: `npm run test && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 2: Publish the (now backfilled) Zwitch Wash site**

As the impersonating admin, open the Zwitch Wash draft and click Publish.
Expected: no "JSON error"; success state with a `*.autocaregeniushub.com` URL. The draft preview also loads quickly now.

- [ ] **Step 3: Confirm published row**

Via Supabase MCP `execute_sql`:
```sql
select slug, published_url from sites where id = '216f44df-0fd2-4d43-a64f-6e72bd7487f3';
```
Expected: `slug` and `published_url` populated.

- [ ] **Step 4: New-upload smoke test**

In a fresh draft, upload a large (>3 MB) photo to the hero slot.
Expected: slot shows "Uploading…", then renders from a `site-images` URL; `images.hero` is an `https://…supabase.co/…/hero-*.jpg` URL, not base64.

- [ ] **Step 5: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "test(images): verify storage upload + publish end-to-end" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** backend=Supabase Storage (Tasks 2-3); compression (Task 2 `downscaleToJpegBlob`, Task 6 sharp); auto-migrate on open (Task 5) + Zwitch backfill (Task 6); bucket/policies mirroring `sites` ownership incl. super-admin for impersonation (Task 3); templates/publish untouched (no task needed, by design). All covered.
- **Node-env test constraint:** only pure helpers + injected-fn orchestration are unit-tested; canvas/Storage paths are verified via build + manual (Task 7). This is deliberate — vitest runs `environment: 'node'`.
- **Type/name consistency:** `uploadSiteImage(source, { siteId, imageKey })`, `migrateLegacyImages(images, siteId, { uploadFn })`, `buildImagePath(siteId, imageKey, suffix)`, `partitionLegacyImages -> { toMigrate, keep }` used consistently across tasks.
- **siteId availability:** guaranteed set before the editor renders (App.jsx:221 for new, :371 for existing).
