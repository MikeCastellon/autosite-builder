// Browser side of the custom website projects: the admin calls
// (custom-site-admin, signed-in super admin) and the customer form calls
// (custom-site-form, token from the link). Field list and stages live in
// customSiteForm.js.
import { supabase } from './supabase.js';
import { ASSET_BUCKET } from './customSiteForm.js';

const ADMIN_FN = '/.netlify/functions/custom-site-admin';
const SUGGEST_FN = '/.netlify/functions/custom-site-suggest';
const FORM_FN = '/.netlify/functions/custom-site-form';

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw Object.assign(new Error('Can\'t reach the server. Check your connection and try again.'), { offline: true });
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, data });
  }
  return data;
}

// ─── Admin ────────────────────────────────────────────────────────────

export async function customSiteAdmin(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return request(ADMIN_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
}

// "Suggest a design" (custom-site-suggest): start { id } claims a run and
// starts the background function; get { id } returns { suggestion }.
export async function customSiteSuggest(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return request(SUGGEST_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
}

// ─── Customer form ────────────────────────────────────────────────────

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function loadIntake(token) {
  return request(`${FORM_FN}?t=${encodeURIComponent(token)}`);
}

// Assets go back without the signed preview URLs the page holds for them.
function storedAssets(assets) {
  return assets.map(({ path, kind, name, size, type, note }) => ({ path, kind, name, size, type, ...(note ? { note } : {}) }));
}

export function saveIntake(token, form, assets) {
  return request(FORM_FN, json({ action: 'save', t: token, form, assets: storedAssets(assets) }));
}

export function submitIntake(token, form, assets) {
  return request(FORM_FN, json({ action: 'submit', t: token, form, assets: storedAssets(assets) }));
}

// Last-chance save when the tab is hidden or closed: a beacon still goes
// out while the page unloads, a fetch may not.
export function beaconSaveIntake(token, form, assets) {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
  const blob = new Blob(
    [JSON.stringify({ action: 'save', t: token, form, assets: storedAssets(assets) })],
    { type: 'application/json' },
  );
  return navigator.sendBeacon(FORM_FN, blob);
}

// Uploads one file straight to storage through a signed URL the function
// mints for this project. Returns the asset to keep in the form.
export async function uploadIntakeFile(token, kind, file) {
  const { path, uploadToken } = await request(FORM_FN, json({
    action: 'upload-url', t: token, kind, fileName: file.name, size: file.size,
  }));
  const { error } = await supabase.storage.from(ASSET_BUCKET)
    .uploadToSignedUrl(path, uploadToken, file, file.type ? { contentType: file.type } : undefined);
  if (error) throw new Error(error.message || 'Upload failed');
  return { path, kind, name: file.name, size: file.size, type: file.type || '' };
}

// ─── Design step ──────────────────────────────────────────────────────

// Starts the copy-writing run custom-site-admin `design-generate` claimed.
// A background function: it answers 202 at once and the project page polls.
export async function startDesignRun(projectId, startedAt) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  let res;
  try {
    res = await fetch('/.netlify/functions/custom-site-design-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: projectId, startedAt }),
    });
  } catch {
    throw new Error('Can\'t reach the server. Check your connection and try again.');
  }
  if (!res.ok && res.status !== 202) throw new Error(`Could not start (${res.status})`);
}

const TYPES_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' };

// Formats that can be see-through: a logo in one of these is stored as-is
// (the shared uploader re-encodes to JPEG, which turns transparency black).
const KEEP_AS_IS = ['png', 'webp', 'gif', 'svg'];
const MAX_AS_IS_BYTES = 5 * 1024 * 1024;

// SVGs are served from storage as they are: refuse ones that can run code
// (scripts, event handlers, javascript: links, embedded documents).
export function svgHasActiveContent(text) {
  const src = String(text).replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, n) => {
    const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
  if (/<script[\s>/]|<(?:iframe|embed|object|foreignObject)[\s>/]|\son[a-z]+\s*=/i.test(src)) return true;
  return /javascript:|data:text\/html/i.test(src.replace(/[\u0000- ]+/g, ''));
}

// Copies one of the customer's uploads (a signed link to the private bucket)
// into the site's public images. Photos go through the editor's own upload
// (downsized, re-encoded, photo location data dropped); a logo with
// transparency is stored as-is. Returns the public URL.
export async function importAssetToSite({ url, name, siteId, imageKey }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${name}`);
  const blob = await res.blob();
  const ext = String(name).split('.').pop().toLowerCase();
  const type = TYPES_BY_EXT[ext] || blob.type || 'application/octet-stream';
  if (imageKey === 'logo' && KEEP_AS_IS.includes(ext) && blob.size <= MAX_AS_IS_BYTES) {
    if (ext === 'svg' && svgHasActiveContent(await blob.text())) {
      throw new Error(`${name} contains scripts, so it can't be used. Ask for a clean SVG or a PNG.`);
    }
    const path = `${siteId}/logo-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from('site-images').upload(path, blob, { upsert: true, contentType: type });
    if (error) throw new Error(error.message || 'Upload failed');
    return supabase.storage.from('site-images').getPublicUrl(path).data.publicUrl;
  }
  const { uploadSiteImage } = await import('./imageUpload.js');
  return uploadSiteImage(new File([blob], name, { type }), { siteId, imageKey });
}
