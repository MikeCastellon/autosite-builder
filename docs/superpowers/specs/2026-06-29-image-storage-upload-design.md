# Image Storage Upload — Design

**Date:** 2026-06-29
**Status:** Approved (pending spec review)
**Project:** Genius Websites (Website Creator)

## Problem

Uploaded site images are stored as base64 data URLs inside `sites.generated_content._images`.
On publish, `exportHtmlString` embeds them inline, so the HTML POSTed to the
`publish-site` Netlify function equals the total image weight.

The Zwitch Wash draft (`216f44df-0fd2-4d43-a64f-6e72bd7487f3`) carries 15 base64
JPEGs totaling **30.7 MB** (hero 2.58 MB, about 1.96 MB, logo 0.79 MB, gallery0–11
0.58–3.29 MB each). AWS Lambda — which Netlify Functions run on — rejects any
synchronous request body over ~6 MB at the platform level, before the function
code runs, returning a **non-JSON** error page.

The client then calls `await res.json()` on that non-JSON body
(`publishSite.js:28`), which throws `SyntaxError: ...is not valid JSON`. That
message surfaces as `publishError` (`StepExport.jsx:37`) — the "JSON error" the
owner sees. The same 30 MB blob also makes the editor/preview sluggish to load
("can't view the draft").

## Goal

Store images as files in object storage and keep only their **public URLs** in
`_images`. Publish payload drops from ~30 MB to a few KB. Templates already render
whatever string sits in `src`, so a URL works exactly where a data URL did — no
template changes required.

## Decisions (confirmed)

1. **Backend:** Supabase Storage. The `supabase` client is already wired app-wide;
   a public bucket yields a permanent public URL on upload with one SDK call, no
   new server function, and uploads run correctly under the impersonated session.
2. **Compression:** downscale on upload — cap longest edge at 2000px, re-encode
   JPEG at quality 0.85, via an offscreen `<canvas>`. A ~3 MB phone photo becomes
   ~300 KB.
3. **Migration:** auto-migrate base64 `_images` to URLs when a site is opened in
   the editor, **plus** a one-off backfill of the Zwitch Wash draft now so
   zwitchwash can publish immediately.

## Architecture

### New module: `src/lib/imageUpload.js`

Single responsibility: take a `File` (or a base64 data URL, for migration) and a
`{ siteId, imageKey }`, return a public URL.

```
uploadSiteImage(fileOrDataUrl, { siteId, imageKey }) -> Promise<string publicUrl>
```

- `downscaleToJpegBlob(source) -> Blob` — load into an `Image`, draw onto a
  `<canvas>` capped at 2000px longest edge, `canvas.toBlob('image/jpeg', 0.85)`.
  Accepts both a `File` and a data URL string (migration reuses this).
- Upload path: `${siteId}/${imageKey}-${shortHash}.jpg` where `shortHash` is a
  short content/time hash so re-uploading the same slot busts caches and never
  collides. Uses `supabase.storage.from('site-images').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })`, then `getPublicUrl(path)`.
- Errors throw with a clear message; callers surface them in existing UI states.

What it depends on: the `supabase` client and the `site-images` bucket. Nothing
depends on its internals beyond the two exported functions.

### Upload call sites (the one chokepoint + two inline twins)

- `ImageSlot.handleFile` (`ContentEditor.jsx:289`) — replace
  `reader.readAsDataURL` with `uploadSiteImage(file, { siteId, imageKey })`; set
  the returned URL via `onChange`. Show a per-slot uploading state and an error
  state on failure.
- The inline product-image handler (`ContentEditor.jsx:937`) and any other
  `readAsDataURL` slot (`shadeN`) get the same treatment.
- `ImageSlot`/`GallerySlots` need `siteId` and the slot `imageKey` in scope;
  thread `siteId` down from `ContentEditor`'s props (it already has the site
  context via App state).

Because URLs are short, `images` state, `saveSite`, `exportHtmlString`, and
`publishSite` are unchanged in shape — they just carry URLs.

### Migration on open: `migrateLegacyImages`

In `App.handleEditSite` (`App.jsx:370`), after extracting `siteImages = copy._images`,
detect any value starting with `data:image`. If found:
- For each base64 entry, call `uploadSiteImage(dataUrl, { siteId, imageKey })`
  (reuses the downscale path), collect URL results.
- Replace those entries with URLs, `setImages(migrated)`, and persist via
  `saveSite` so the row heals permanently.
- Run best-effort: a failed image keeps its base64 value (still editable; just not
  yet migrated) and logs a warning. Show a one-time non-blocking toast
  ("Optimizing images…") while it runs.

### One-off backfill (Zwitch Wash, now)

A Node script `scripts/backfill-site-images.mjs` run with the service-role key
from `.env`:
- Fetch the target site row(s) with base64 in `_images`.
- For each image: decode base64 → downscale with `sharp` (cap 2000px, JPEG 0.85)
  → upload to `site-images` via the service-role Storage API → collect public URL.
- Rewrite `generated_content._images` to URLs and update the row.
- Idempotent: skips entries already on `https://`.
- Takes a `--site <id>` arg; default targets the Zwitch Wash id.

`sharp` is a dev-only dependency for this script; it is not added to the app bundle.

### Storage bucket + policies (migration SQL)

Create a public bucket `site-images` and policies mirroring `sites` ownership so
the path's first folder (`siteId`) must belong to the caller (or a super-admin),
which keeps impersonated uploads working:

- Bucket: `site-images`, `public = true`.
- `SELECT` (read): public (bucket is public).
- `INSERT`/`UPDATE`/`DELETE`: `bucket_id = 'site-images'` AND the first path
  segment equals a `sites.id` owned by `auth.uid()`, OR `is_super_admin(auth.uid())`.
  Expressed with `(storage.foldername(name))[1]::uuid` joined against `sites`.

## Data flow (after)

```
file pick ─► downscale (canvas) ─► supabase.storage.upload ─► public URL
          └─► images[key] = URL ─► saveSite (_images = {key: URL})
publish ─► exportHtmlString embeds <img src="URL"> ─► ~KB POST ─► 200 JSON
```

## Error handling

- Upload failure: per-slot error message in the editor; the slot keeps its prior
  value. No silent base64 fallback for *new* uploads (that would reintroduce the
  bug).
- Migration failure for an image: keep its base64, log, continue — the site is
  still editable and will retry on next open.
- The client's `res.json()` on the publish error path stays, but with payloads
  now under the limit it won't be hit by oversized bodies. (Optional hardening,
  out of scope: guard `res.json()` with a text fallback so any future non-JSON
  platform error shows a readable message instead of a parse error.)

## Testing

- `imageUpload`: unit-test `downscaleToJpegBlob` dimension capping and that a
  data-URL input and a File input both produce a JPEG blob (jsdom + canvas mock).
- Migration: given an `_images` with mixed base64/URL values, `migrateLegacyImages`
  uploads only the base64 ones and returns an all-URL map; a thrown upload leaves
  that key as base64.
- Backfill script: dry-run mode logs planned conversions without writing.
- Manual: re-open the Zwitch Wash draft (or run backfill), confirm `_images` is
  all URLs and `length(generated_content::text)` drops to low KB, then publish
  succeeds (200 JSON, `published_url` set).

## Out of scope

- Migrating already-published live sites' embedded base64 (they re-heal if the
  owner re-opens/re-publishes).
- Switching the publish HTML transport off Netlify functions.
- Reworking R2 publishing.

## Affected files

- New: `src/lib/imageUpload.js`, `scripts/backfill-site-images.mjs`, storage
  bucket/policy migration.
- Edit: `src/components/preview/ContentEditor.jsx` (upload call sites + slot
  uploading/error UI, thread `siteId`), `src/App.jsx` (`handleEditSite`
  migration), tests.
- Unchanged: templates, `exportHtml.js`, `publishSite.js`, `saveSite.js` shape,
  `publish-site` function.
