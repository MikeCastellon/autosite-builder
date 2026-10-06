// The Launch Kit for custom websites (Admin > Custom websites > a project >
// "Launch kit"): per-customer deliverables made by Claude Agent Skills that
// run in Anthropic's code execution container, one skill per tile. This is
// the registry and the run record every part shares: the server
// (netlify/functions/custom-site-kit*.js, _lib/kit/), the admin panel
// (LaunchKitPanel.jsx, customSiteKit.js) and the release tooling
// (scripts/skills-release.mjs, scripts/skills-smoke.mjs).
//
// A run lives in custom_site_projects.design.kit[key] (no migration):
//   { status: 'running' | 'ready' | 'failed', startedAt, finishedAt, model,
//     skillVersion, files: [{ name, path, type, size }], data, usage:
//     { input_tokens, output_tokens }, notes: [string], warnings: [string],
//     error }
// `data` is the skill's JSON file after that skill's sanitizer
// (_lib/kit/<key>.js); `files` are the stored copies in the private
// custom-site-assets bucket at kitFilePath(); `notes` come from the skill,
// `warnings` from the server (an optional file that didn't come back, an
// upload that was left out). Signed URLs are made by custom-site-kit `get`,
// never stored. Only the kit functions write design.kit, with the same
// read-modify-write + updated_at guard as the brand run.
//
// Pure module with no imports: the browser, the functions and the Node
// scripts all load it.

// ─── The skills ───────────────────────────────────────────────────────

// Tiers: what the base custom website includes, and the add-ons.
export const KIT_TIERS = Object.freeze([
  Object.freeze({ id: 'launch', label: 'Launch kit', hint: 'Included with every custom website' }),
  Object.freeze({ id: 'signature', label: 'Signature add-ons', hint: 'Print and social, for the bigger packages' }),
]);

// What a "needs" entry means besides another kit key.
export const KIT_NEED_LABELS = Object.freeze({
  site: 'the written site',
  brand: 'the brand system',
  published: 'a published site (its live link)',
});

const json = (name, label) => ({ name, type: 'application/json', label, required: true });
const png = (name, label, required, px) => ({ name, type: 'image/png', label, required, ...(px ? { px } : {}) });
const pdf = (name, label, required) => ({ name, type: 'application/pdf', label, required });

function entry(e) {
  return Object.freeze({
    ...e,
    // The JSON output that becomes run.data (the first output).
    dataFile: e.outputs[0].name,
    outputs: Object.freeze(e.outputs.map((o) => Object.freeze({ ...o, ...(o.px ? { px: Object.freeze(o.px) } : {}) }))),
    needs: Object.freeze(e.needs),
    uses: Object.freeze(e.uses),
  });
}

// One entry per skill, in the order the panel shows them.
//   key       design.kit key and the _lib/kit/<key>.js module name
//   folder    the skill folder under skills/api/ (= the SKILL.md name)
//   envPrefix <prefix>_SKILL_ID / <prefix>_SKILL_VERSION on Netlify
//   outputs   the only files taken from $OUTPUT_DIR, the JSON first.
//             required: the run fails without it; otherwise a missing file
//             is a warning. px: [width, height] a PNG should have (checked,
//             a mismatch is a warning).
//   needs     what must exist before a run makes sense ("needs X first"):
//             other kit keys (ready runs), 'site' (the project has a written
//             site) or 'brand' (a ready brand system)
//   uses      read when ready, never required
//   estimate  what one run usually costs, for the confirm dialog
export const KIT_SKILLS = Object.freeze([
  entry({
    key: 'photos',
    folder: 'launch-photo-desk',
    label: 'Photo desk',
    blurb: 'Ranks the customer\'s photos for the hero, about and gallery, with crops for desktop and phone, alt text, before/after pairs, plates and faces to blur, and a shot list for what\'s missing.',
    tier: 'launch',
    envPrefix: 'CUSTOM_SITE_KIT_PHOTOS',
    outputs: [json('photos.json', 'Photo picks'), png('contact_sheet.png', 'Contact sheet', false)],
    needs: [],
    uses: [],
    estimate: 'about $0.3-1',
  }),
  entry({
    key: 'mobile',
    folder: 'launch-mobile-kit',
    label: 'Mobile kit',
    blurb: 'Home-screen and browser icons from the logo, the phone headline and section order, tap-to-call/text/book actions, a text-for-a-quote link, a contact card and a phone scorecard.',
    tier: 'launch',
    envPrefix: 'CUSTOM_SITE_KIT_MOBILE',
    outputs: [
      json('mobile.json', 'Mobile plan'),
      png('apple-touch-icon.png', 'Apple touch icon (180)', false, [180, 180]),
      png('icon-192.png', 'App icon (192)', false, [192, 192]),
      png('icon-512.png', 'App icon (512)', false, [512, 512]),
      png('favicon-32.png', 'Favicon (32)', false, [32, 32]),
      { name: 'contact.vcf', type: 'text/vcard', label: 'Contact card', required: true },
    ],
    needs: ['site'],
    uses: ['brand'],
    estimate: 'about $0.2-0.6',
  }),
  entry({
    key: 'words',
    folder: 'launch-words',
    label: 'Words',
    blurb: 'Paste-ready Google Business Profile copy (description, services, 12 posts), SEO title and description, review request texts and replies, and a social bio with captions.',
    tier: 'launch',
    envPrefix: 'CUSTOM_SITE_KIT_WORDS',
    outputs: [json('words.json', 'Copy deck'), pdf('words.pdf', 'Printable copy deck', false)],
    needs: ['site'],
    uses: ['brand', 'photos'],
    estimate: 'about $0.3-1',
  }),
  entry({
    key: 'claims',
    folder: 'launch-claims-ledger',
    label: 'Claims ledger',
    blurb: 'Checks every claim on the site and in the kit against what the customer actually told us, and flags anything without a source for a rewrite before launch.',
    tier: 'launch',
    envPrefix: 'CUSTOM_SITE_KIT_CLAIMS',
    outputs: [json('ledger.json', 'Claims ledger')],
    needs: ['site'],
    uses: ['words', 'print', 'social'],
    estimate: 'about $0.2-0.6',
  }),
  entry({
    key: 'print',
    folder: 'launch-print-studio',
    label: 'Print studio',
    blurb: 'Print-ready PDFs with bleed and crop marks: business cards, a glovebox card (save contact + rebook QR codes), and a review hang tag and counter card when there\'s a Google profile.',
    tier: 'signature',
    envPrefix: 'CUSTOM_SITE_KIT_PRINT',
    outputs: [
      json('print.json', 'Print plan'),
      pdf('review-hang-tag.pdf', 'Review hang tag', false),
      pdf('counter-card.pdf', 'Counter card', false),
      pdf('glovebox-card.pdf', 'Glovebox card', true),
      pdf('business-cards.pdf', 'Business cards', true),
    ],
    needs: ['site'],
    uses: ['brand', 'words'],
    estimate: 'about $0.4-1.2',
  }),
  entry({
    key: 'social',
    folder: 'launch-social-kit',
    label: 'Social kit',
    blurb: 'A share image for links, a Facebook cover, a profile picture, three launch posts and a story, from the customer\'s own photos and logo in the brand colors, with captions.',
    tier: 'signature',
    envPrefix: 'CUSTOM_SITE_KIT_SOCIAL',
    outputs: [
      json('social.json', 'Social plan'),
      png('share-1200x630.png', 'Share image', true, [1200, 630]),
      png('facebook-cover.png', 'Facebook cover', false, [1640, 624]),
      png('profile-800.png', 'Profile picture', false, [800, 800]),
      png('post-1.png', 'Post 1', false, [1080, 1080]),
      png('post-2.png', 'Post 2', false, [1080, 1080]),
      png('post-3.png', 'Post 3', false, [1080, 1080]),
      png('story-1080x1920.png', 'Story', false, [1080, 1920]),
    ],
    needs: ['site'],
    uses: ['brand', 'photos', 'words'],
    estimate: 'about $0.4-1.2',
  }),
  entry({
    key: 'handover',
    folder: 'launch-handover',
    label: 'Handover pack',
    blurb: 'The customer\'s handover PDF (what we built and why, brand, links, how to edit, the claims sign-off, a 30-day checklist) and one zip with every kit file.',
    tier: 'launch',
    envPrefix: 'CUSTOM_SITE_KIT_HANDOVER',
    outputs: [
      json('handover.json', 'Handover outline'),
      pdf('handover.pdf', 'Handover PDF', true),
      { name: 'launch-kit.zip', type: 'application/zip', label: 'Launch kit (zip)', required: false },
    ],
    needs: ['site', 'published'],
    uses: ['brand', 'photos', 'mobile', 'words', 'claims', 'print', 'social'],
    estimate: 'about $0.3-1',
  }),
]);

const BY_KEY = Object.freeze(Object.fromEntries(KIT_SKILLS.map((s) => [s.key, s])));

// The panel's groups, in build order: what reads another part comes after
// it (words before claims, print and social; everything before handover).
export const KIT_GROUPS = Object.freeze([
  Object.freeze({ id: 'build', label: 'Build', hint: 'Start here: photos, the phone kit and the launch words.', keys: Object.freeze(['photos', 'mobile', 'words']) }),
  Object.freeze({ id: 'signature', label: 'Signature add-ons', hint: 'Print and social, for the bigger packages. They use the brand system and the words.', keys: Object.freeze(['print', 'social']) }),
  Object.freeze({ id: 'finish', label: 'Check and hand over', hint: 'Last: check every claim, then make the handover pack.', keys: Object.freeze(['claims', 'handover']) }),
]);
export const KIT_KEYS = Object.freeze(KIT_SKILLS.map((s) => s.key));

// A registry key (own keys only: 'toString' or '__proto__' is no skill).
export function isKitKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(BY_KEY, key);
}

export function kitSkill(key) {
  return isKitKey(key) ? BY_KEY[key] : null;
}

export function kitOutput(key, name) {
  return kitSkill(key)?.outputs.find((o) => o.name === name) || null;
}

// The env var names a skill's id and version are read from.
export function kitEnvNames(key) {
  const s = kitSkill(key);
  return s ? { id: `${s.envPrefix}_SKILL_ID`, version: `${s.envPrefix}_SKILL_VERSION` } : null;
}

// "the brand system", "the Words run" for a needs/uses entry.
export function kitNeedLabel(need) {
  if (Object.prototype.hasOwnProperty.call(KIT_NEED_LABELS, need)) return KIT_NEED_LABELS[need];
  const s = kitSkill(need);
  return s ? s.label : String(need || '');
}

// ─── Runs ─────────────────────────────────────────────────────────────

// The run happens in a background function, which Netlify stops after 15
// minutes. The Claude turns get KIT_BUDGET_MS from the claim, which leaves
// time to download, check and store the files; a claim still "running"
// after KIT_STALE_MS has died, and a new run may start.
export const KIT_BUDGET_MS = 11 * 60 * 1000;
export const KIT_STALE_MS = 14 * 60 * 1000;
export const KIT_NOTES_MAX = 8;
export const KIT_WARNINGS_MAX = 10;
const KIT_FILES_MAX = 16;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Model and customer text on one line, capped.
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// An ISO-ish time Date.parse reads, else null. Compared with Date.parse
// everywhere: Postgres hands back '+00:00' where the claim wrote 'Z'.
function timeOf(v) {
  return typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : null;
}

export function isKitRunStale(run, nowMs = Date.now()) {
  if (run?.status !== 'running') return false;
  const started = Date.parse(run.startedAt || '');
  return !Number.isFinite(started) || nowMs - started > KIT_STALE_MS;
}

// Is a run going (running and not stale)?
export function isKitRunLive(run, nowMs = Date.now()) {
  return run?.status === 'running' && !isKitRunStale(run, nowMs);
}

// Is `run` the running run that started at `startedAt`? Compared as
// instants, so '…Z' and '…+00:00' match.
export function isSameKitClaim(run, startedAt) {
  return run?.status === 'running' && !!startedAt
    && Number.isFinite(Date.parse(startedAt))
    && Date.parse(run.startedAt || '') === Date.parse(startedAt);
}

// The token counts a run reports, as whole numbers.
export function kitUsage(usage) {
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);
  return { input_tokens: n(usage?.input_tokens), output_tokens: n(usage?.output_tokens) };
}

// The stored shape of a run that ended without a result.
export function failedKitRun({ startedAt, finishedAt = new Date().toISOString(), error, model = null, usage = null, skillVersion = null }) {
  return {
    status: 'failed',
    startedAt: startedAt || null,
    finishedAt,
    model: model || null,
    skillVersion: skillVersion || null,
    files: [],
    data: null,
    usage: kitUsage(usage),
    notes: [],
    warnings: [],
    error: oneLine(String(error || 'Something went wrong'), 500) || 'Something went wrong',
  };
}

// What the panel shows for a run:
//   idle     no run yet
//   running  a run is going
//   stale    "running" for longer than a run can take (custom-site-kit
//            `get` turns it into failed too)
//   ready    done, with data
//   failed   failed, or "ready" without data
export function kitRunState(run, nowMs = Date.now()) {
  if (!isObject(run) || typeof run.status !== 'string') return 'idle';
  if (run.status === 'running') return isKitRunStale(run, nowMs) ? 'stale' : 'running';
  if (run.status === 'ready') return isObject(run.data) ? 'ready' : 'failed';
  if (run.status === 'failed') return 'failed';
  return 'idle';
}

// ─── Stored files ─────────────────────────────────────────────────────

// Where a run's file is stored in the private custom-site-assets bucket:
// "<projectId>/kit/<key>/<ms>-<filename>". The customer's own uploads sit
// under logo/brand/reference/photo, so "kit/" never matches one of theirs.
export function kitFilePath(projectId, key, filename, ms) {
  return `${projectId}/kit/${key}/${Math.round(ms)}-${filename}`;
}

const KIT_PATH_RE = /^([a-z]+)\/(\d{1,16})-([A-Za-z0-9._-]{1,80})$/;

// { key, ms, name } for a stored kit file path of this project (only names
// from that skill's outputs), else null.
export function parseKitFilePath(projectId, path) {
  if (typeof projectId !== 'string' || !projectId || typeof path !== 'string') return null;
  const prefix = `${projectId}/kit/`;
  if (!path.startsWith(prefix)) return null;
  const m = KIT_PATH_RE.exec(path.slice(prefix.length));
  if (!m || !kitOutput(m[1], m[3])) return null;
  return { key: m[1], ms: Number(m[2]), name: m[3] };
}

// Is `path` a stored file of this project's kit (of `key`, when given)?
export function isKitFilePath(projectId, path, key) {
  const p = parseKitFilePath(projectId, path);
  return !!p && (key === undefined || p.key === key);
}

// ─── The record ──────────────────────────────────────────────────────

function sanitizeFiles(raw, { projectId, key }) {
  const out = [];
  for (const f of Array.isArray(raw) ? raw : []) {
    if (!isObject(f) || typeof f.name !== 'string' || typeof f.path !== 'string') continue;
    if (key && !kitOutput(key, f.name)) continue;
    if (projectId) {
      const p = parseKitFilePath(projectId, f.path);
      if (!p || p.name !== f.name || (key && p.key !== key)) continue;
    }
    if (out.some((o) => o.name === f.name)) continue;
    const size = Number(f.size);
    out.push({
      name: f.name,
      path: f.path,
      type: oneLine(f.type, 100) || (key ? kitOutput(key, f.name)?.type : '') || 'application/octet-stream',
      size: Number.isFinite(size) && size >= 0 ? Math.round(size) : 0,
    });
    if (out.length >= KIT_FILES_MAX) break;
  }
  return out;
}

const lines = (raw, max, each = 300) => (Array.isArray(raw) ? raw : [])
  .map((n) => oneLine(typeof n === 'string' ? n : '', each)).filter(Boolean).slice(0, max);

// A design.kit[key] record in the stored shape, or null when it isn't one.
// With `key`, only that skill's output names are kept; with `projectId`
// too, only paths that are this project's kit files. `data` is kept as the
// skill's sanitizer left it (a plain object), never re-shaped here.
export function sanitizeKitRun(raw, { projectId, key } = {}) {
  if (!isObject(raw) || !['running', 'ready', 'failed'].includes(raw.status)) return null;
  return {
    status: raw.status,
    startedAt: timeOf(raw.startedAt),
    finishedAt: timeOf(raw.finishedAt),
    model: oneLine(raw.model, 80) || null,
    skillVersion: oneLine(raw.skillVersion, 128) || null,
    files: sanitizeFiles(raw.files, { projectId, key }),
    data: isObject(raw.data) ? raw.data : null,
    usage: kitUsage(raw.usage),
    notes: lines(raw.notes, KIT_NOTES_MAX),
    warnings: lines(raw.warnings, KIT_WARNINGS_MAX),
    error: oneLine(raw.error, 500) || null,
    // The admin's sign-off on the claims ledger (custom-site-kit sign-off).
    ...(key === 'claims' ? {
      signOff: isObject(raw.signOff) && timeOf(raw.signOff.at)
        ? { at: timeOf(raw.signOff.at), by: oneLine(raw.signOff.by, 120) || null }
        : null,
    } : {}),
  };
}

// design.kit as a map of registry keys to records (anything else dropped).
export function kitOf(project) {
  const kit = isObject(project?.design?.kit) ? project.design.kit : {};
  const out = {};
  for (const key of KIT_KEYS) if (isObject(kit[key])) out[key] = kit[key];
  return out;
}

export function kitRunOf(project, key) {
  return isKitKey(key) ? kitOf(project)[key] || null : null;
}

// ─── Dependencies ────────────────────────────────────────────────────

// Is one `needs` entry met for this project?
//   site   the project has a written site (custom-site-design created it)
//   brand  design.brand is a ready brand system
//   <key>  design.kit[key] is ready
export function kitNeedMet(need, project, nowMs = Date.now()) {
  if (need === 'site') return !!(project?.site_id || project?.site?.id || project?.design?.siteId);
  if (need === 'published') return !!(project?.site?.publishedUrl || project?.site_url);
  if (need === 'brand') return project?.design?.brand?.status === 'ready';
  if (isKitKey(need)) return kitRunState(kitRunOf(project, need), nowMs) === 'ready';
  return false;
}

// The needs of `key` this project doesn't meet yet: [{ id, label }].
export function kitMissingNeeds(key, project, nowMs = Date.now()) {
  const s = kitSkill(key);
  if (!s) return [];
  return s.needs.filter((n) => !kitNeedMet(n, project, nowMs)).map((n) => ({ id: n, label: kitNeedLabel(n) }));
}

// The parts this run read (its `uses`) that were rebuilt after it started,
// and the written site when it was rewritten since: [{ id, label }]. A
// ready run listed here shows "built before the latest X".
export function kitOutdatedUses(key, project, run = kitRunOf(project, key)) {
  const s = kitSkill(key);
  const started = Date.parse(run?.startedAt || '');
  if (!s || !Number.isFinite(started)) return [];
  const finished = (id) => {
    if (id === 'brand') return project?.design?.brand?.status === 'ready' ? Date.parse(project.design.brand.finishedAt || '') : NaN;
    const other = kitRunOf(project, id);
    return other?.status === 'ready' ? Date.parse(other.finishedAt || '') : NaN;
  };
  const out = s.uses.filter((id) => finished(id) > started).map((id) => ({ id, label: kitNeedLabel(id) }));
  const siteWritten = Date.parse(project?.design_finished_at || '');
  if (siteWritten > started && s.needs.includes('site')) out.push({ id: 'site', label: kitNeedLabel('site') });
  return out;
}
