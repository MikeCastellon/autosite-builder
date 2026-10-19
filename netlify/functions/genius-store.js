// netlify/functions/genius-store.js
// The editor's Genius Store tab: turn on the owner's store, and say what
// exists. Genius Storefronts (its own Supabase project) owns the partner, the
// storefront, attribution and payouts; this only vouches for the owner and
// relays to its website-partner function with the shared secret, so the
// secret never reaches a browser. Spec:
// docs/superpowers/specs/2026-10-19-genius-store-design.md
//
// POST { action, ... }, Bearer token:
//   terms                                     the partner agreement to show
//   status { siteId }                         partner + this site's storefront,
//                                             plus whether the site shows it
//   enable { siteId, termsVersion, accent, scheme }
//                                             approved partner + storefront
//
// The email sent on is always the signed-in owner's (requireUser /
// requireSiteOwner), never one from the request body: the partner it creates
// is paid. On a design with the Shop section, enable also saves the slug in
// the site's copy (copy.store), so turning the store on from the Genius Store
// page puts it on the site without the editor; the editor sets the same key.
//
// Env: GENIUS_STOREFRONTS_URL (website-partner's URL), GENIUS_WEBSITES_KEY.
// Without them it answers 503, so a deploy without the store set up says so
// instead of failing in a way the owner cannot read.
import { requireSiteOwner, requireUser, supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { templateReads } from '../../src/components/preview/editorCapabilities.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const TIMEOUT_MS = 15000;

// website-partner's refusals, in words for the owner.
const REFUSALS = {
  suspended: 'Your Genius Store account is on hold. Contact Auto Care Genius support to turn it back on.',
  staff_account: 'This email is an Auto Care Genius staff login, so it can\'t also run a store. Use a different account for this website.',
  terms_changed: 'The store terms were just updated. Read them again and agree to turn on your store.',
};

// What the site itself shows: does its design have the Shop section, and is
// a store saved on it (copy.store.slug in generated_content)?
function siteStore(site) {
  const slug = site?.generated_content?.store?.slug;
  return {
    siteHasShop: templateReads(site?.template_id, 'store'),
    storeOnSite: typeof slug === 'string' && slug ? slug : null,
    published: Boolean(site?.published_url),
  };
}

// Save the store on the site (copy.store), keeping the owner's heading and
// intro. Only on a design that reads it; a failure here never undoes the
// store itself, the owner can still add it from the editor.
async function saveStoreOnSite(site, slug) {
  if (!slug || !templateReads(site.template_id, 'store')) return false;
  const content = site.generated_content && typeof site.generated_content === 'object' ? site.generated_content : {};
  const current = content.store && typeof content.store === 'object' ? content.store : {};
  if (current.slug === slug) return true;
  const { error } = await supabaseAdmin()
    .from('sites')
    .update({ generated_content: { ...content, store: { ...current, slug } } })
    .eq('id', site.id);
  if (error) {
    console.error(`[genius-store] could not save the store on site ${site.id}:`, error.message);
    return false;
  }
  return true;
}

async function callStorefronts(payload) {
  const url = process.env.GENIUS_STOREFRONTS_URL;
  const key = process.env.GENIUS_WEBSITES_KEY;
  if (!url || !key) {
    const err = new Error('The Genius Store isn\'t set up yet. Try again later.');
    err.status = 503;
    throw err;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-genius-websites-key': key },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error('[genius-store] Storefronts unreachable:', e?.message || e);
    const err = new Error('Couldn\'t reach the Genius Store. Please try again.');
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = body?.error;
    console.error(`[genius-store] ${payload.action} -> ${res.status} ${code || ''}`);
    const err = new Error(REFUSALS[code] || 'The Genius Store couldn\'t do that right now. Please try again.');
    err.status = REFUSALS[code] ? res.status : 502;
    err.code = code;
    throw err;
  }
  return body;
}

// The partner's name: the owner's own name if the profile has it, else the
// business name.
async function ownerName(userId, businessName) {
  try {
    const { data } = await supabaseAdmin()
      .from('profiles').select('first_name, last_name').eq('id', userId).maybeSingle();
    const name = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
    return name || businessName || '';
  } catch {
    return businessName || '';
  }
}

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const headers = jsonHeaders(event.headers);
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON' }); }
  const { action, siteId } = body || {};

  try {
    if (action === 'terms') {
      await requireUser(event);
      const terms = await callStorefronts({ action: 'terms' });
      return reply(200, { version: terms.version, terms: terms.terms });
    }

    if (action !== 'status' && action !== 'enable') return reply(400, { error: 'Unknown action' });
    if (!UUID.test(String(siteId || ''))) return reply(400, { error: 'Missing siteId' });

    const { user, site } = await requireSiteOwner(event, siteId);
    const email = String(user.email || '').toLowerCase();
    if (!email) return reply(400, { error: 'Your account has no email address.' });

    if (action === 'status') {
      const status = await callStorefronts({ action: 'status', email, siteId });
      return reply(200, { ...status, ...siteStore(site), email });
    }

    const termsVersion = String(body.termsVersion || '');
    if (!termsVersion) return reply(400, { error: 'Please agree to the store terms first.' });
    const businessName = String(site.business_info?.businessName || '').trim();
    const result = await callStorefronts({
      action: 'provision',
      email,
      siteId,
      termsVersion,
      name: await ownerName(user.id, businessName),
      company: businessName,
      storeName: businessName,
      accent: HEX.test(String(body.accent || '')) ? body.accent : undefined,
      // The site's look: a dark site starts with a dark store.
      scheme: body.scheme === 'dark' ? 'dark' : 'light',
    });
    const saved = await saveStoreOnSite(site, result.storefront?.slug);
    console.log(`[genius-store] site=${siteId} store=${result.storefront?.slug} created=${Boolean(result.created)} onSite=${saved}`);
    const shown = siteStore(site);
    return reply(200, { ...result, ...shown, storeOnSite: saved ? result.storefront.slug : shown.storeOnSite, email });
  } catch (err) {
    return reply(err.status || 500, { error: err.message || 'Something went wrong', code: err.code });
  }
};
