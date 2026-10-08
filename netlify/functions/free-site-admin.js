// POST /.netlify/functions/free-site-admin
//
// Admin > Free websites. Super admins only. A team member adds a customer
// (name + email), builds their site with the normal builder in their own
// account, then hands it to the customer's account (created if needed),
// with the same hand-over as a custom website (_lib/custom-site-handover.js).
// One endpoint, one `action` per operation:
//   list                          → { handovers, mySites }: every row, latest
//                                   activity first, with its site; mySites:
//                                   the caller's own websites no row holds
//                                   (for "a site I already built")
//   create       { firstName, lastName?, email, phone?, businessName?, note?, siteId? }
//   update       { id, firstName?, lastName?, email?, phone?, businessName?, note? }
//                                 → before the hand-over only
//   link-site    { id, siteId }   → the row's site is one already built in a
//                                   team account (replaces the current one)
//   handover-check { id }         → the customer's account, if they have one
//   handover     { id, compPro, sendEmail } → moves the site to the customer's
//                                   account (created if needed) and emails them
//   handover-email { id }         → sends the access email again
//   delete       { id }           → removes the row; a site not handed over
//                                   stays in its builder's account
//
// The builder links a new site by itself: the wizard saves the row's id as
// business_info.freeSiteId (src/lib/freeSiteHandover.js), and list /
// handover pick that site up. The table has RLS on with no policies (see
// the migration), so this function, with the service role, is the only way in.
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { accessLink, findCustomerAccount, handOverSite } from './_lib/custom-site-handover.js';
import { freeSiteHandover } from './_lib/postmark.js';
import { FREE_SITE_MARKER, isEmail, sanitizeCustomer } from '../../src/lib/freeSiteHandover.js';

const TABLE = 'free_site_handovers';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');
const SITE_FIELDS = 'id, user_id, slug, published_url, template_id, site_type, updated_at, business_info';

const fail = (status, message) => Object.assign(new Error(message), { status });

async function loadRow(db, id) {
  if (typeof id !== 'string' || !id) return null;
  const { data } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  return data || null;
}

async function profilesById(db, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await db.from('profiles').select('id, email, is_super_admin').in('id', unique);
  return new Map((data || []).map((p) => [p.id, p]));
}

// Websites only: a booking page has no site to build.
const isWebsite = (site) => (site.site_type || 'website') === 'website';

// Sets (rowId) or removes (null) the free-website marker on a site.
async function setSiteMarker(db, siteId, rowId) {
  const { data: site } = await db.from('sites').select('id, business_info').eq('id', siteId).maybeSingle();
  if (!site) return;
  const businessInfo = { ...(site.business_info || {}) };
  if (rowId) businessInfo[FREE_SITE_MARKER] = rowId;
  else delete businessInfo[FREE_SITE_MARKER];
  const { error } = await db.from('sites').update({ business_info: businessInfo }).eq('id', siteId);
  if (error) console.error(`[free-site-admin] marker not ${rowId ? 'set' : 'removed'} on site ${siteId}:`, error.message);
}

// Rows the builder started a site for: the wizard's first save carries the
// row's id as business_info.freeSiteId. Links the newest such site in a
// team account to each row without one. Mutates and returns `rows`.
async function linkMarkedSites(db, rows) {
  const open = rows.filter((r) => !r.site_id && !r.handed_over_at);
  if (!open.length) return rows;
  const { data: sites } = await db.from('sites')
    .select('id, user_id, updated_at, site_type, business_info')
    .in(`business_info->>${FREE_SITE_MARKER}`, open.map((r) => r.id));
  if (!sites?.length) return rows;
  const owners = await profilesById(db, sites.map((s) => s.user_id));
  const taken = new Set(rows.map((r) => r.site_id).filter(Boolean));
  for (const row of open) {
    const site = sites
      .filter((s) => s.business_info?.[FREE_SITE_MARKER] === row.id && isWebsite(s) && owners.get(s.user_id)?.is_super_admin && !taken.has(s.id))
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
    if (!site) continue;
    const { data, error } = await db.from(TABLE).update({ site_id: site.id }).eq('id', row.id).is('site_id', null).select('*').maybeSingle();
    if (error) { console.error('[free-site-admin] site not linked:', error.message); continue; }
    if (data) { Object.assign(row, data); taken.add(site.id); }
  }
  return rows;
}

// A site a row may hold: a website in a team (super admin) account, not a
// custom website's site and not held by another row.
async function checkLinkable(db, siteId, rowId) {
  if (typeof siteId !== 'string' || !siteId) throw fail(400, 'Pick a site');
  const { data: site } = await db.from('sites').select(SITE_FIELDS).eq('id', siteId).maybeSingle();
  if (!site) throw fail(404, 'That site no longer exists');
  if (!isWebsite(site)) throw fail(400, 'Pick a website, not a booking page');
  if (site.business_info?.customProjectId) throw fail(400, 'That site belongs to a custom website project');
  const owners = await profilesById(db, [site.user_id]);
  if (!owners.get(site.user_id)?.is_super_admin) throw fail(409, 'That site is already in a customer\'s account');
  const { data: holder } = await db.from(TABLE).select('id').eq('site_id', site.id).maybeSingle();
  if (holder && holder.id !== rowId) throw fail(409, 'Another free website already uses that site');
  return site;
}

function siteSummary(site, owner) {
  if (!site) return null;
  return {
    id: site.id,
    userId: site.user_id,
    ownerEmail: owner?.email || null,
    ownerIsAdmin: !!owner?.is_super_admin,
    name: site.business_info?.businessName || '',
    templateId: site.template_id,
    publishedUrl: site.published_url || null,
    updatedAt: site.updated_at,
  };
}

// Rows as the Admin tab shows them: each with its site and who added it.
async function withSites(db, rows) {
  const ids = rows.map((r) => r.site_id).filter(Boolean);
  const { data: sites } = ids.length ? await db.from('sites').select(SITE_FIELDS).in('id', ids) : { data: [] };
  const byId = new Map((sites || []).map((s) => [s.id, s]));
  const people = await profilesById(db, [...(sites || []).map((s) => s.user_id), ...rows.map((r) => r.created_by)]);
  return rows.map((r) => {
    const site = byId.get(r.site_id);
    return {
      ...r,
      site: siteSummary(site, site && people.get(site.user_id)),
      createdByEmail: people.get(r.created_by)?.email || null,
    };
  });
}

// Sends the access email and records the outcome on the row. Returns the
// error message, or null when it went out.
async function sendAccessEmail(db, row, { newAccount, actor }) {
  const email = String(row.client_email || '').trim().toLowerCase();
  let message = null;
  try {
    const [{ data: site }, account] = await Promise.all([
      row.site_id ? db.from('sites').select('published_url').eq('id', row.site_id).maybeSingle() : { data: null },
      findCustomerAccount(db, email),
    ]);
    const actionUrl = await accessLink(db, { email, newAccount, appUrl: APP_URL });
    await freeSiteHandover({
      to: email,
      // The customer's reply reaches the admin who handed the site over.
      replyTo: isEmail(actor) ? actor : undefined,
      firstName: row.client_first_name,
      businessName: row.business_name,
      siteUrl: site?.published_url || null,
      actionUrl,
      newAccount,
      email,
      pro: !!account?.isPro,
    });
  } catch (e) {
    message = (e?.message || 'Email failed to send').slice(0, 300);
  }
  const patch = message ? { email_error: message } : { email_sent_at: new Date().toISOString(), email_error: null };
  const { error } = await db.from(TABLE).update(patch).eq('id', row.id);
  if (error) console.error('[free-site-admin] email outcome not saved:', error.message);
  return message;
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
  let actor;
  let adminUser;
  try {
    ({ actor, user: adminUser } = await requireSuperAdmin(event, db));
  } catch (e) {
    return reply(e.status || 401, { error: e.message || 'Not signed in' });
  }

  try {
    switch (body.action) {
      case 'list': {
        const { data, error } = await db.from(TABLE).select('*').order('updated_at', { ascending: false }).limit(1000);
        if (error) throw fail(500, 'Could not load free websites');
        const rows = await linkMarkedSites(db, data || []);
        const held = new Set(rows.map((r) => r.site_id).filter(Boolean));
        const { data: own } = await db.from('sites')
          .select('id, site_type, published_url, template_id, updated_at, business_info')
          .eq('user_id', adminUser.id);
        const mySites = (own || [])
          .filter((s) => isWebsite(s) && !s.business_info?.customProjectId && !held.has(s.id))
          .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
          .map((s) => ({ id: s.id, name: s.business_info?.businessName || '', templateId: s.template_id, publishedUrl: s.published_url || null, updatedAt: s.updated_at }));
        return reply(200, { handovers: await withSites(db, rows), mySites });
      }

      case 'create': {
        const { values, error: invalid } = sanitizeCustomer(body);
        if (invalid) return reply(400, { error: invalid });
        const site = body.siteId ? await checkLinkable(db, body.siteId, null) : null;
        const { data: created, error } = await db.from(TABLE)
          .insert({ ...values, site_id: site?.id || null, created_by: adminUser.id })
          .select('*')
          .single();
        if (error) {
          console.error('[free-site-admin] create failed:', error.message);
          return reply(500, { error: 'Could not add the customer' });
        }
        if (site) await setSiteMarker(db, site.id, created.id);
        return reply(200, { handover: (await withSites(db, [created]))[0] });
      }

      case 'update': {
        const current = await loadRow(db, body.id);
        if (!current) return reply(404, { error: 'Not found' });
        if (current.handed_over_at) return reply(400, { error: 'The site is already in their account' });
        const { values, error: invalid } = sanitizeCustomer(body, { partial: true });
        if (invalid) return reply(400, { error: invalid });
        if (!Object.keys(values).length) return reply(400, { error: 'Nothing to change' });
        const { data, error } = await db.from(TABLE).update(values).eq('id', current.id).select('*').single();
        if (error) return reply(500, { error: 'Could not save' });
        return reply(200, { handover: (await withSites(db, [data]))[0] });
      }

      case 'link-site': {
        const current = await loadRow(db, body.id);
        if (!current) return reply(404, { error: 'Not found' });
        if (current.handed_over_at) return reply(400, { error: 'The site is already in their account' });
        const site = await checkLinkable(db, body.siteId, current.id);
        const { data, error } = await db.from(TABLE).update({ site_id: site.id }).eq('id', current.id).select('*').single();
        if (error) return reply(500, { error: 'Could not link the site' });
        if (current.site_id && current.site_id !== site.id) await setSiteMarker(db, current.site_id, null);
        await setSiteMarker(db, site.id, current.id);
        return reply(200, { handover: (await withSites(db, [data]))[0] });
      }

      case 'handover-check': {
        const current = await loadRow(db, body.id);
        if (!current) return reply(404, { error: 'Not found' });
        const account = await findCustomerAccount(db, current.client_email);
        return reply(200, { account });
      }

      case 'handover': {
        const current = await loadRow(db, body.id);
        if (!current) return reply(404, { error: 'Not found' });
        if (current.handed_over_at) return reply(409, { error: 'The site is already in their account' });
        await linkMarkedSites(db, [current]);
        if (!current.site_id) return reply(400, { error: 'Build the site first' });
        const { data: site } = await db.from('sites').select('id, user_id').eq('id', current.site_id).maybeSingle();
        if (!site) return reply(404, { error: 'The site no longer exists' });
        const owners = await profilesById(db, [site.user_id]);
        if (!owners.get(site.user_id)?.is_super_admin) return reply(409, { error: 'The site is already in a customer\'s account' });

        let result;
        try {
          result = await handOverSite({ db, project: current, compPro: !!body.compPro });
        } catch (e) {
          return reply(e.status || 500, { error: e.message || 'Could not hand over the site' });
        }
        const { data } = await db.from(TABLE).update({
          handed_over_at: new Date().toISOString(),
          handed_over_by: adminUser.id,
          customer_user_id: result.userId,
          comp_pro: !!body.compPro,
        }).eq('id', current.id).select('*').single();
        const row = data || current;
        const emailError = body.sendEmail === false ? null : await sendAccessEmail(db, row, { newAccount: result.newAccount, actor });
        const fresh = (await loadRow(db, row.id)) || row;
        return reply(200, {
          handover: (await withSites(db, [fresh]))[0],
          newAccount: result.newAccount,
          widgetsRemoved: result.widgetsRemoved,
          emailError,
        });
      }

      case 'handover-email': {
        const current = await loadRow(db, body.id);
        if (!current) return reply(404, { error: 'Not found' });
        if (!current.handed_over_at) return reply(400, { error: 'Hand the site over first' });
        // A new account's first email held a set-password link; resending
        // makes a fresh one if the customer never signed in.
        const { data: authUser } = current.customer_user_id
          ? await db.auth.admin.getUserById(current.customer_user_id)
          : { data: null };
        const neverSignedIn = !authUser?.user?.last_sign_in_at;
        const emailError = await sendAccessEmail(db, current, { newAccount: neverSignedIn, actor });
        if (emailError) return reply(502, { error: emailError });
        return reply(200, { ok: true });
      }

      case 'delete': {
        const current = await loadRow(db, body.id);
        if (!current) return reply(404, { error: 'Not found' });
        const { error } = await db.from(TABLE).delete().eq('id', current.id);
        if (error) return reply(500, { error: 'Could not delete' });
        // The site stays in its builder's account as their own site again.
        if (current.site_id && !current.handed_over_at) await setSiteMarker(db, current.site_id, null);
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[free-site-admin] failed:', e?.message || e);
    return reply(e.status || 500, { error: e.status ? e.message : 'Something went wrong' });
  }
};
