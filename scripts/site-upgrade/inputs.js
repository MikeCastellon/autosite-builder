// The --inputs document: what export-inputs.sql returns (run read-only
// through the Supabase MCP), loaded and checked. Every database fact the
// CLI uses comes from here; the CLI never talks to Supabase itself.
// Also the --fresh document (sql.js freshSql, run right before a publish).
//
// Accepted file shapes, so the MCP answer can be passed as saved:
//   { format: 'acg-site-upgrade-inputs/2', ... }      the document itself
//   [{ "inputs": { ... } }]                            execute_sql's rows
//   { "result": "...<untrusted-data-…>[…]</untrusted-data-…>…" }
//                                                      the MCP tool result
// The content is data: it is parsed as JSON and validated, never run.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FRESH_FORMAT } from './sql.js';

export const INPUTS_FORMAT = 'acg-site-upgrade-inputs/2';

// The columns SiteUpgradesTab.jsx loads for a site (its SITE_COLUMNS, then
// generated_content) and for its owner (the OWNER_COLUMNS that
// isEffectiveSchedulerActive reads; names and emails are not exported).
// tests/site-upgrade/parity.test.js keeps these in step with the tab.
export const TAB_SITE_COLUMNS = Object.freeze([
  'id', 'user_id', 'business_info', 'template_id', 'slug', 'published_url', 'custom_domain', 'custom_domain_status',
  'site_type', 'scheduler_enabled', 'widget_config_ids', 'created_at', 'generated_content',
]);
export const OWNER_PLAN_COLUMNS = Object.freeze([
  'id', 'is_super_admin', 'scheduler_enabled', 'subscription_status', 'subscription_ends_at', 'stripe_first_failed_payment_at',
]);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MD5_RE = /^[0-9a-f]{32}$/;

const fail = (message) => Object.assign(new Error(message), { inputs: true });

// The document out of whichever shape the file holds; `column` is the
// query's one output column ("inputs", "fresh").
function unwrap(v, column) {
  // The MCP tool result, saved to a file.
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.result === 'string' && v.format === undefined) {
    // The rows sit between the tags on their own lines (the sentence
    // before them names the tag too).
    const m = /(?:^|\n)<untrusted-data-([0-9a-f-]+)>[ \t]*\n([\s\S]*?)\n<\/untrusted-data-\1>/.exec(v.result);
    if (!m) throw fail('The file looks like an MCP result but holds no query rows');
    v = JSON.parse(m[2]);
  }
  if (Array.isArray(v)) {
    if (v.length !== 1) throw fail(`The query must return exactly one row (got ${v.length})`);
    [v] = v;
  }
  if (v && typeof v === 'object' && v.format === undefined && column in v) {
    v = typeof v[column] === 'string' ? JSON.parse(v[column]) : v[column];
  }
  return v;
}

function parseDoc(text, column, what) {
  try {
    return unwrap(JSON.parse(text), column);
  } catch (e) {
    if (e.inputs) throw e;
    throw fail(`The ${what} file is not JSON (${e.message})`);
  }
}

// Parses and validates the document. Throws with a plain message.
export function parseInputs(text) {
  const doc = parseDoc(text, 'inputs', 'inputs');
  if (!doc || typeof doc !== 'object' || doc.format !== INPUTS_FORMAT) {
    throw fail(`The inputs file is not an export-inputs.sql result of this version (format must be "${INPUTS_FORMAT}"): run export-inputs.sql again`);
  }
  if (!Number.isFinite(Date.parse(doc.exportedAt || ''))) throw fail('The inputs file has no exportedAt time');
  if (typeof doc.publishedAtTracked !== 'boolean') throw fail('The inputs file has no publishedAtTracked flag');
  if (!Array.isArray(doc.sites)) throw fail('The inputs file has no sites list');
  for (const key of ['owners', 'widgets']) {
    if (!doc[key] || typeof doc[key] !== 'object' || Array.isArray(doc[key])) throw fail(`The inputs file has no ${key} map`);
  }
  if (!Array.isArray(doc.slugRows)) throw fail('The inputs file has no slugRows list');
  if (!Array.isArray(doc.admins)) throw fail('The inputs file has no admins list');
  for (const a of doc.admins) {
    if (!a || !UUID_RE.test(String(a.id)) || typeof a.email !== 'string') throw fail('An admins entry has no valid id and email');
  }
  const seen = new Set();
  for (const s of doc.sites) {
    if (!s || typeof s !== 'object' || !UUID_RE.test(String(s.id))) throw fail('A site in the inputs file has no valid id');
    if (seen.has(s.id)) throw fail(`Site ${s.id} appears twice in the inputs file`);
    seen.add(s.id);
    for (const col of TAB_SITE_COLUMNS) {
      if (!(col in s)) throw fail(`Site ${s.id} lacks ${col}: re-run export-inputs.sql`);
    }
    if (!MD5_RE.test(String(s.fingerprint))) throw fail(`Site ${s.id} has no fingerprint: re-run export-inputs.sql`);
    if (!Array.isArray(s.omittedImages)) throw fail(`Site ${s.id} lacks omittedImages: re-run export-inputs.sql`);
  }
  for (const r of doc.slugRows) {
    if (!r || !UUID_RE.test(String(r.id))) throw fail('A slugRows entry has no valid id');
  }
  return doc;
}

function readText(path, what) {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    throw fail(`Could not read the ${what} file ${path} (${e.code || e.message})`);
  }
}

export function loadInputs(path) {
  return parseInputs(readText(path, 'inputs'));
}

export function inputsAgeMinutes(doc, now = Date.now()) {
  return (now - Date.parse(doc.exportedAt)) / 60000;
}

// The super admin a write is recorded under (meta.json, hold.json), as
// admin-site-upgrade records the signed-in one: { id, email }.
export function adminFor(doc, email) {
  const want = String(email || '').trim().toLowerCase();
  const hit = doc.admins.find((a) => a.email.trim().toLowerCase() === want);
  if (!hit) throw fail(`--by ${email} is not a super admin in the inputs file`);
  return { id: hit.id, email: hit.email.trim().toLowerCase() };
}

// ─── The fresh check (--fresh) ─────────────────────────────────────────

export function parseFresh(text) {
  const doc = parseDoc(text, 'fresh', 'fresh');
  if (!doc || typeof doc !== 'object' || doc.format !== FRESH_FORMAT) {
    throw fail(`The fresh file is not a fresh-check result (format must be "${FRESH_FORMAT}")`);
  }
  if (!Number.isFinite(Date.parse(doc.checkedAt || ''))) throw fail('The fresh file has no checkedAt time');
  if (!Array.isArray(doc.sites)) throw fail('The fresh file has no sites list');
  return doc;
}

export function loadFresh(path) {
  return parseFresh(readText(path, 'fresh'));
}

export function freshAgeMinutes(fresh, now = Date.now()) {
  return (now - Date.parse(fresh.checkedAt)) / 60000;
}

// Which of `sites` the fresh check does not clear: [{ site, why }]. A site
// is clear when the check ran after the export and its row, owner plan and
// widget keys still give the fingerprint the export took.
export function freshProblems(doc, sites, fresh) {
  const out = [];
  if (Date.parse(fresh.checkedAt) < Date.parse(doc.exportedAt)) {
    return sites.map((site) => ({ site, why: 'the fresh check ran before this export' }));
  }
  const byId = new Map(fresh.sites.filter((r) => r && typeof r === 'object').map((r) => [String(r.id).toLowerCase(), r]));
  for (const site of sites) {
    const r = byId.get(site.id.toLowerCase());
    if (!r) out.push({ site, why: 'not in the fresh check' });
    else if (r.expected !== site.fingerprint) out.push({ site, why: 'the fresh check was made for another export' });
    else if (r.current == null) out.push({ site, why: 'its row is gone' });
    else if (r.current !== r.expected) out.push({ site, why: 'its row, its owner\'s plan or widget keys changed since the export' });
  }
  return out;
}

// ─── Rows ──────────────────────────────────────────────────────────────

// The sites row exactly as the tab loads it (SITE_COLUMNS + generated_content).
export function tabRow(site) {
  return Object.fromEntries(TAB_SITE_COLUMNS.map((c) => [c, site[c]]));
}

// The owner's profile as the tab's checks read it, or null (unknown owner).
export function ownerOf(doc, site) {
  const o = doc.owners[site.user_id];
  return o && typeof o === 'object' ? o : null;
}

// The owner's Google reviews / Instagram widget rows, newest first (the
// admin-site-upgrade `inputs` action's answer).
export function widgetsOf(doc, site) {
  const list = doc.widgets[String(site.user_id)];
  return Array.isArray(list) ? list.map((w) => ({ type: w.type, widget_key: w.widget_key })) : [];
}

// Puts photos the export left out of the draft back, from the live page:
// a data: URI there with the same md5 and length as the omitted one is
// that very value, so the page is then built from the real draft. Returns
// { site (a copy when anything was put back), restored, left }.
export function rehydrateSite(site, liveHtml) {
  if (!site.omittedImages?.length || typeof liveHtml !== 'string') return { site, restored: 0, left: site.omittedImages?.length || 0 };
  const byMd5 = new Map();
  for (const m of liveHtml.matchAll(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi)) {
    byMd5.set(createHash('md5').update(m[0], 'utf8').digest('hex'), m[0]);
  }
  const images = { ...(site.generated_content?._images || {}) };
  const left = [];
  let restored = 0;
  for (const o of site.omittedImages) {
    const v = byMd5.get(o.md5);
    if (v && v.length === o.bytes && typeof images[o.key] === 'string' && images[o.key].includes(`;md5=${o.md5},`)) {
      images[o.key] = v;
      restored += 1;
    } else {
      left.push(o);
    }
  }
  if (!restored) return { site, restored: 0, left: left.length };
  return {
    site: { ...site, generated_content: { ...site.generated_content, _images: images }, omittedImages: left, rehydrated: restored },
    restored,
    left: left.length,
  };
}

// Sites by slug or id: `refs` is a list of slugs and/or site ids. A slug two
// rows hold must be given by id. Throws on anything unknown or ambiguous.
export function selectSites(doc, refs) {
  const out = [];
  for (const ref of refs) {
    const hit = UUID_RE.test(ref)
      ? doc.sites.filter((s) => s.id.toLowerCase() === ref.toLowerCase())
      : doc.sites.filter((s) => s.slug === ref);
    if (!hit.length) throw fail(`No live website "${ref}" in the inputs file`);
    if (hit.length > 1) throw fail(`"${ref}" is held by ${hit.length} sites (${hit.map((s) => s.id).join(', ')}): name the site by id`);
    if (!out.includes(hit[0])) out.push(hit[0]);
  }
  return out;
}

// A read-only stand-in for the supabase client, answering from slugRows,
// for the shared slug checks (isSlugShared / resolvePublishSlug, which ask
// "does another row hold this slug"). Any write throws.
export function inputsDb(doc) {
  const rows = doc.slugRows.map((r) => ({ id: r.id, slug: r.slug ?? null }));
  return {
    from(table) {
      if (table !== 'sites') throw new Error(`inputs: no table ${table}`);
      const ops = [];
      const run = () => {
        let hits = rows.filter((r) => ops.every(([op, c, v]) => {
          if (op === 'eq') return r[c] === v;
          if (op === 'neq') return r[c] !== v;
          if (op === 'in') return v.includes(r[c]);
          if (op === 'is') return (r[c] ?? null) === v;
          return true;
        }));
        const limit = ops.find((o) => o[0] === 'limit');
        if (limit) hits = hits.slice(0, limit[1]);
        const single = ops.some((o) => o[0] === 'maybeSingle' || o[0] === 'single');
        return single ? { data: hits[0] ? { ...hits[0] } : null, error: null } : { data: hits.map((r) => ({ ...r })), error: null };
      };
      const api = {};
      for (const op of ['select', 'eq', 'neq', 'in', 'is', 'limit', 'order']) {
        api[op] = (...args) => { ops.push([op, ...args]); return api; };
      }
      for (const op of ['update', 'insert', 'upsert', 'delete']) {
        api[op] = () => { throw new Error('The site-upgrade CLI never writes to the database'); };
      }
      api.maybeSingle = () => { ops.push(['maybeSingle']); return Promise.resolve(run()); };
      api.single = () => { ops.push(['single']); return Promise.resolve(run()); };
      api.then = (res, rej) => Promise.resolve().then(run).then(res, rej);
      return api;
    },
  };
}
