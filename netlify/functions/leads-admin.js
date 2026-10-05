// POST /.netlify/functions/leads-admin
//
// Admin > Leads: the parts of a scan that need the service role or the
// Google key. Super admins only. Everything else on the Leads and Pipeline
// tabs reads and writes the sales_* tables straight from the browser, under
// the is_super_admin RLS policies (db/migrations/20261005_sales_pipeline_and_leads.sql).
//
//   scan-claim   { area, radiusMi, categories } → resolves the area on Google
//                Maps and claims a scan row; the browser then calls
//                leads-scan-background with { scanId }. 409 while another
//                scan is running.
//   scan-release { scanId, error } → gives a claimed scan up when the browser
//                could not start the background run.
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { requireSuperAdmin } from './_shared/adminAuth.js';
import { CATEGORY_KEYS, RADIUS_OPTIONS } from '../../src/lib/leadCategories.js';
import { PlacesFatalError, ScanRunningError, claimScan, resolveArea } from './_lib/leadScan.js';

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export const handler = async (event) => {
  const CORS = jsonHeaders(event.headers);
  const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(event.headers) };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const db = supabaseAdmin();
  let adminUser;
  try {
    ({ user: adminUser } = await requireSuperAdmin(event, db, 'leads-admin'));
  } catch (e) {
    return reply(e.status || 401, { error: e.message || 'Not signed in' });
  }

  try {
    switch (body.action) {
      case 'scan-claim': {
        const areaQuery = clean(body.area, 120);
        if (areaQuery.length < 2) return reply(400, { error: 'Type a city, zip or state to scan.' });
        const radiusMi = Number(body.radiusMi);
        if (!RADIUS_OPTIONS.includes(radiusMi)) return reply(400, { error: 'Pick a radius.' });
        const categories = [...new Set(Array.isArray(body.categories) ? body.categories : [])]
          .filter((k) => CATEGORY_KEYS.includes(k));
        if (!categories.length) return reply(400, { error: 'Pick at least one type of business.' });

        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) return reply(500, { error: 'GOOGLE_PLACES_API_KEY is not set on this site.' });

        let area;
        try {
          area = await resolveArea({ fetchImpl: fetch, apiKey, text: areaQuery });
        } catch (e) {
          console.error('[leads-admin] area lookup failed:', e.message);
          // A refused key is a setup problem the admin can fix (Places API
          // (New) not enabled on the key); say so rather than "try again".
          return reply(502, {
            error: e instanceof PlacesFatalError
              ? 'Google refused the Places key. Check GOOGLE_PLACES_API_KEY is valid and has "Places API (New)" enabled in Google Cloud.'
              : 'Google Maps didn\'t answer. Try again in a minute.',
          });
        }
        if (!area) return reply(400, { error: `Google Maps doesn't know "${areaQuery}". Try a city and state, or a zip.` });

        try {
          const scan = await claimScan(db, { areaQuery, area, radiusMi, categories, requestedBy: adminUser.id });
          return reply(200, { scan });
        } catch (e) {
          if (e instanceof ScanRunningError) return reply(409, { error: 'A scan is already running. Wait for it to finish.' });
          throw e;
        }
      }

      case 'scan-release': {
        const scanId = clean(body.scanId, 64);
        if (!scanId) return reply(400, { error: 'Missing scanId' });
        // Only a claim nobody started: a running scan finishes on its own.
        await db.from('sales_prospect_scans').update({
          finished_at: new Date().toISOString(),
          error: `Couldn't start the scan: ${clean(body.error, 200) || 'unknown error'}`,
        }).eq('id', scanId).is('finished_at', null).is('run_started_at', null);
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[leads-admin] failed:', e?.message || e);
    return reply(e.status || 500, { error: 'Something went wrong. Try again.' });
  }
};
