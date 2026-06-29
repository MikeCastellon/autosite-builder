// One-off backfill: convert inline base64 images in sites.generated_content._images
// to Supabase Storage URLs, so the site's publish payload stays under Netlify's
// ~6 MB function limit.
//
// This is an OPTIONAL manual fallback. The app already auto-migrates a draft's
// base64 images to storage the next time it is opened in the editor
// (see migrateLegacyImages in src/lib/imageUpload.js + App.handleEditSite).
// Use this script only to heal a site without opening it in the browser.
//
// Requirements:
//   - env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from process.env
//     or from a local .env / .env.local file). The service-role key is NOT stored
//     in this repo — supply it yourself when running.
//   - optional: `npm i -D sharp` to downscale images (cap 2000px, JPEG q85).
//     Without sharp, originals are uploaded as-is (still fixes the publish error,
//     but published images stay full-size).
//
// Usage:
//   node scripts/backfill-site-images.mjs --site <id> [--dry]
//   (default --site is the Zwitch Wash draft)

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'site-images';
const DEFAULT_SITE = '216f44df-0fd2-4d43-a64f-6e72bd7487f3'; // Zwitch Wash

// --- args ---
const argv = process.argv.slice(2);
const siteId = argv.includes('--site') ? argv[argv.indexOf('--site') + 1] : DEFAULT_SITE;
const dry = argv.includes('--dry');

// --- env (process.env, then .env.local, then .env) ---
function loadEnvFile(path, into) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && into[m[1]] === undefined) into[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const env = { ...process.env };
loadEnvFile('.env.local', env);
loadEnvFile('.env', env);

const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in env or .env).');
  process.exit(1);
}

// --- optional sharp ---
let sharp = null;
try { ({ default: sharp } = await import('sharp')); }
catch { console.warn('sharp not installed — uploading originals without downscaling.'); }

const supabase = createClient(url, key);
const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:image');

const { data: site, error } = await supabase
  .from('sites').select('id, generated_content').eq('id', siteId).single();
if (error) { console.error(error); process.exit(1); }

const gc = site.generated_content || {};
const images = gc._images || {};
const out = { ...images };
let changed = 0;

for (const [imageKey, value] of Object.entries(images)) {
  if (!isDataUrl(value)) continue;
  const input = Buffer.from(value.split(',')[1], 'base64');
  const bytes = sharp
    ? await sharp(input).resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
    : input;
  const path = `${siteId}/${imageKey}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  console.log(`${imageKey}: ${(input.length / 1048576).toFixed(2)}MB -> ${(bytes.length / 1048576).toFixed(2)}MB  ${path}`);
  if (dry) { changed++; continue; }
  const up = await supabase.storage.from(BUCKET).upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });
  if (up.error) { console.error(`upload ${imageKey} failed:`, up.error.message); continue; }
  out[imageKey] = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  changed++;
}

if (!dry && changed > 0) {
  const { error: upErr } = await supabase
    .from('sites').update({ generated_content: { ...gc, _images: out } }).eq('id', siteId);
  if (upErr) { console.error('row update failed:', upErr); process.exit(1); }
}
console.log(`${dry ? '[dry] would convert' : 'converted'} ${changed} image(s).`);
