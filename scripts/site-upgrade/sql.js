// The SQL the operator (Claude, through the Supabase MCP) runs for the CLI,
// which never connects to the database itself. Every value is checked
// against a strict pattern before it goes into a statement.
//   freshSql      READ-ONLY, right before a publish: for each site, the
//                 fingerprint now next to the one the export took. Its saved
//                 result is publish's --fresh file: the CLI refuses a site
//                 whose row, owner plan or widget keys changed since the
//                 export (the tab re-reads all of them before each upload).
//   driftSql      READ-ONLY, after a publish and before publishedSql: the
//                 same comparison for the sites just published.
//   publishedSql  after a publish: what admin-site-upgrade's publish writes
//                 (published_url, unchanged, and published_at), keyed by
//                 site id and slug, never over a newer published_at. Needs
//                 the owner's approval to run.
//   restoreSql    after a restore: published_at back to null, as the
//                 function's restore does. Needs the owner's approval.
import { PUBLISH_DOMAIN } from './net.js';

// Everything a site's new page is built from, as one md5: the row's
// columns the render and the checks read, its published_at (an owner's
// own republish stamps it), the owner's plan fields (the "Powered by" bar)
// and their widget keys, newest first (the Google reviews / Instagram
// widgets). jsonb_build_array keeps nulls and positions apart.
// Must stay the same expression as in export-inputs.sql (a test checks).
export const FINGERPRINT_SQL = "md5(jsonb_build_array(s.template_id, s.slug, s.published_url, s.site_type, s.scheduler_enabled, s.custom_domain, s.custom_domain_status, s.widget_config_ids, md5(coalesce(s.business_info::text, '')), md5(coalesce(s.generated_content::text, '')), to_jsonb(s) -> 'published_at', (select jsonb_build_array(p.is_super_admin, p.scheduler_enabled, p.subscription_status, p.subscription_ends_at, p.stripe_first_failed_payment_at) from public.profiles p where p.id = s.user_id), (select coalesce(jsonb_agg(jsonb_build_array(w.type, w.widget_key) order by w.created_at desc, w.id desc), '[]'::jsonb) from public.widget_configs w where w.user_id = s.user_id::text and w.type in ('instagram-feed', 'google-reviews')))::text)";

export const FRESH_FORMAT = 'acg-site-upgrade-fresh/1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9-]{1,63}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MD5_RE = /^[0-9a-f]{32}$/;

function lit(value, re, what) {
  const v = String(value ?? '');
  if (!re.test(v)) throw new Error(`Refusing to put an unexpected ${what} into SQL: ${JSON.stringify(v).slice(0, 80)}`);
  return `'${v}'`;
}

export function publishedUrlFor(slug) {
  return `https://${slug}.${PUBLISH_DOMAIN}`;
}

// A statement shown for reading only: every line commented out under a
// header saying why, so a copy of it can never run.
export function inert(sql, why) {
  if (!sql) return '';
  return [`-- ${why}`, ...sql.split('\n').map((l) => `-- ${l}`)].join('\n');
}

// sites: [{ id, fingerprint }] (the export's rows)
export function freshSql(sites) {
  if (!sites.length) return '';
  const rows = sites.map((s) => `(${lit(s.id, UUID_RE, 'site id')}::uuid, ${lit(s.fingerprint, MD5_RE, 'fingerprint')})`);
  return [
    `-- READ-ONLY site-upgrade fresh check for ${sites.length} site${sites.length === 1 ? '' : 's'}: run it right before publishing and`,
    '-- save the result as the --fresh file. It changes nothing.',
    'select jsonb_build_object(',
    `  'format', '${FRESH_FORMAT}',`,
    "  'checkedAt', now(),",
    "  'sites', coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'expected', v.fp,",
    `    'current', (select ${FINGERPRINT_SQL} from public.sites s where s.id = v.id)) order by v.id), '[]'::jsonb)`,
    ') as fresh',
    `from (values ${rows.join(', ')}) as v(id, fp);`,
  ].join('\n');
}

// records: [{ siteId, slug, publishedAt (ISO, the upload time) }]
export function publishedSql(records, { runId } = {}) {
  if (!records.length) return '';
  const rows = records.map((r) => `  (${lit(r.siteId, UUID_RE, 'site id')}::uuid, ${lit(r.slug, SLUG_RE, 'slug')}, ${lit(publishedUrlFor(r.slug), /^https:\/\/[a-z0-9-]{1,63}\.autocaregeniushub\.com$/, 'url')}, ${lit(r.publishedAt, ISO_RE, 'time')}::timestamptz)`);
  return [
    `-- site-upgrade ${runId ? `run ${runId}: ` : ''}record ${records.length} republished site${records.length === 1 ? '' : 's'}`,
    '-- (what admin-site-upgrade.js writes after a publish). A production write: run it only with the owner\'s approval.',
    `-- Expect ${records.length} row${records.length === 1 ? '' : 's'} back; a missing row means its slug changed since the export, or the`,
    '-- owner published it again after this run (their newer published_at is kept).',
    'update public.sites as s',
    'set published_url = v.published_url, published_at = v.published_at',
    'from (values',
    rows.join(',\n'),
    ') as v(id, slug, published_url, published_at)',
    'where s.id = v.id and s.slug = v.slug',
    '  and (s.published_at is null or s.published_at < v.published_at)',
    'returning s.id, s.slug, s.published_url, s.published_at;',
  ].join('\n');
}

export function restoreSql({ siteId, slug }) {
  return [
    `-- site-upgrade restore: clear published_at for ${slug} (what admin-site-upgrade.js does after a restore).`,
    '-- A production write: run it only with the owner\'s approval. Expect 1 row back.',
    'update public.sites as s set published_at = null',
    `where s.id = ${lit(siteId, UUID_RE, 'site id')}::uuid and s.slug = ${lit(slug, SLUG_RE, 'slug')}`,
    'returning s.id, s.slug, s.published_at;',
  ].join('\n');
}

// records: [{ siteId, fingerprint }]
export function driftSql(records) {
  if (!records.length) return '';
  const rows = records.map((r) => `(${lit(r.siteId, UUID_RE, 'site id')}::uuid, ${lit(r.fingerprint, MD5_RE, 'fingerprint')})`);
  return [
    '-- READ-ONLY, run it BEFORE the update below: is each row (and its owner\'s plan and widget keys) still what',
    '-- the page was built from? unchanged = false means it changed after the export: run plan again for that site',
    '-- and look at its live page before recording it.',
    `select s.id, s.slug, ${FINGERPRINT_SQL} = v.fp as unchanged`,
    `from public.sites s join (values ${rows.join(', ')}) as v(id, fp) on v.id = s.id;`,
  ].join('\n');
}
