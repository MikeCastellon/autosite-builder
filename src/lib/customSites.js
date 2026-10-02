// Browser side of the custom website projects: the admin calls
// (custom-site-admin, signed-in super admin) and the customer form calls
// (custom-site-form, token from the link). Field list and stages live in
// customSiteForm.js.
import { supabase } from './supabase.js';
import { ASSET_BUCKET } from './customSiteForm.js';

const ADMIN_FN = '/.netlify/functions/custom-site-admin';
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
