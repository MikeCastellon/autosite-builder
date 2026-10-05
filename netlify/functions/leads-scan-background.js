// POST /.netlify/functions/leads-scan-background   { scanId }
//
// Background function (the -background suffix: Netlify answers 202 at once
// and lets this run up to 15 minutes). Runs one Admin > Leads scan that
// leads-admin `scan-claim` already claimed: searches Google Maps around the
// scan's area and writes sales_prospects (netlify/functions/_lib/leadScan.js).
// runClaimedScan takes the claim once, so a double click or a retried request
// can't start a second paid run. The Leads tab polls the scan row for
// finished_at / error.
import { supabaseAdmin } from './_shared/auth.js';
import { requireSuperAdmin } from './_shared/adminAuth.js';
import { runClaimedScan } from './_lib/leadScan.js';

// Leaves four minutes to write before Netlify's 15-minute kill: a scan
// stopped mid-write has paid for searches it never kept.
const DEADLINE_MS = 11 * 60 * 1000;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400 }; }
  if (!body.scanId) return { statusCode: 400 };
  const db = supabaseAdmin();
  try {
    await requireSuperAdmin(event, db, 'leads-scan');
  } catch (e) {
    return { statusCode: e.status || 401 };
  }
  const result = await runClaimedScan({
    db,
    scanId: body.scanId,
    apiKey: process.env.GOOGLE_PLACES_API_KEY,
    deadlineMs: DEADLINE_MS,
    log: (m) => console.log(`[leads-scan] ${m}`),
  });
  if (result.error) console.error('[leads-scan] failed:', result.error);
  return { statusCode: result.status };
};
