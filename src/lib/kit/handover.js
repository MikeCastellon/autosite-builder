// The handover pack of the Launch Kit (skill launch-handover, kit key
// "handover"): handover.pdf for the customer (what we built and why, their
// brand, their links, how to edit, the Launch Kit inventory, the claims
// sign-off, five things to do this week and a 30-day checklist) and
// launch-kit.zip with every kit file the server passed in, one folder per kit
// part. Pure: the server's spec (netlify/functions/_lib/kit/handover.js)
// builds the skill's input file and sanitizes its handover.json with it, the
// admin's result view (components/admin/kit/HandoverResult.jsx) groups the
// zip's files with it, and the skill's Python side (scripts/
// validate_handover.py, data/contract.json, data/kit_files.json) mirrors its
// limits and folders (handover.test.js keeps the two equal).
//
// The stored shape (design.kit.handover.data), version 1:
//   { version: 1,
//     summary,                      one line for the admin, made by the script
//     sections: [title],            the PDF's sections, in page order
//     pages,                        handover.pdf's page count
//     files: [zip path],            what launch-kit.zip holds ("handover.pdf",
//                                   "05-print/business-cards.pdf", ...)
//     left: [{ file, reason }],     kit files meant for the zip that aren't in
//                                   it (a size cap, a file that never came)
//     links: { site, booking, review, signIn },  exactly what the PDF prints
//     thisWeek: [{ title, detail }] x 5,
//     checklist: [{ week: 1-4, task }],
//     claims: { checked, sourced, toConfirm, listed } | null,
//     notes: [string] }
//
// Links are the one thing in the PDF a customer can't check by reading it,
// so the server builds every link itself (handover-inputs.json) and
// sanitizeHandover() drops any link that isn't one of them.
import { KIT_SKILLS, kitSkill } from '../launchKit.js';

export const HANDOVER_VERSION = 1;
export const HANDOVER_INPUTS_VERSION = 1;
export const HANDOVER_INPUTS_FILE = 'handover-inputs.json';
export const HANDOVER_FILES = Object.freeze({ data: 'handover.json', pdf: 'handover.pdf', zip: 'launch-kit.zip' });

// The most launch-kit.zip may weigh: the server takes a zip back up to
// 50 MB (custom-site-kit-background KIT_OUTPUT_MAX_BYTES, also Supabase
// Storage's default object limit); 2 MB under it leaves room for the zip's
// own headers. The skill leaves the lowest-ranked files out to stay under.
export const HANDOVER_ZIP_MAX_BYTES = 48 * 1024 * 1024;
// Statements to confirm sent to the skill (the PDF lists 15; the counts
// always cover all of them).
export const HANDOVER_CLAIMS_MAX = 30;

// The skill's validator (data/contract.json) enforces the same caps, so a
// handover.json that passes it is stored as written.
export const HANDOVER_LIMITS = Object.freeze({
  summary: 600,
  section: 80,
  sections: 16,
  pages: 80,
  files: 80,
  path: 120,
  left: 30,
  reason: 200,
  link: 500,
  thisWeek: 5,
  title: 80,
  detail: 240,
  checklistMin: 4,
  checklist: 24,
  task: 200,
  weeks: 4,
  notes: 8,
  note: 300,
});

// The PDF's sections, in page order (the cover isn't one). "claims" is only
// there when the claims ledger is ready.
export const HANDOVER_SECTIONS = Object.freeze([
  Object.freeze({ id: 'built', title: 'What we built and why' }),
  Object.freeze({ id: 'brand', title: 'Your brand' }),
  Object.freeze({ id: 'links', title: 'Your links' }),
  Object.freeze({ id: 'edit', title: 'How to edit your site' }),
  Object.freeze({ id: 'kit', title: 'Your Launch Kit' }),
  Object.freeze({ id: 'claims', title: 'Claims sign-off' }),
  Object.freeze({ id: 'week', title: 'Do these 5 things this week' }),
  Object.freeze({ id: 'month', title: 'Your first 30 days' }),
]);

const SECTION_TITLES = new Set(HANDOVER_SECTIONS.map((s) => s.title));

// ─── The zip ──────────────────────────────────────────────────────────

// Files at the top of the zip: the PDF and a plain-text guide to the folders.
export const ZIP_ROOT_FILES = Object.freeze([HANDOVER_FILES.pdf, 'README.txt']);
// The brand board from the brand system run (design.brand.boardPath).
export const BRAND_BOARD_FILE = 'brand-board.png';
// Plain-text files the skill writes from the inputs, so the customer can
// copy the words, captions and color codes without retyping a PDF: brand
// from the site's look, words and social from those kit runs' data.
export const GENERATED_ZIP_FILES = Object.freeze({ brand: 'brand-colors.txt', words: 'paste-ready.txt', social: 'captions.txt' });

// The kit runs whose stored files go into the zip, in download priority
// (when the byte budget runs out, the last ones are left out first): the
// print files and the copy deck matter most to a customer.
export const HANDOVER_FILE_KEYS = Object.freeze(['print', 'words', 'mobile', 'social', 'photos']);

const part = (key, folder, label) => Object.freeze({ key, folder, label });
// One folder per kit part, in the order the PDF and the zip list them.
export const ZIP_PARTS = Object.freeze([
  part('brand', '01-brand', 'Brand'),
  part('photos', '02-photos', kitSkill('photos').label),
  part('mobile', '03-mobile', kitSkill('mobile').label),
  part('words', '04-words', kitSkill('words').label),
  part('print', '05-print', kitSkill('print').label),
  part('social', '06-social', kitSkill('social').label),
]);
const PART_BY_KEY = Object.freeze(Object.fromEntries(ZIP_PARTS.map((p) => [p.key, p])));
const hasPart = (key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(PART_BY_KEY, key);

// The stored files of a kit run that go to the customer: everything but the
// run's JSON (photo crops, the ledger and the like are for the admin; the
// PDF says what matters in them).
export function zipFileNames(key) {
  const s = kitSkill(key);
  if (!s || !hasPart(key)) return [];
  return s.outputs.filter((o) => o.type !== 'application/json').map((o) => o.name);
}

const PLAIN_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._()+-]{0,99}$/;

// "05-print/business-cards.pdf" for a part's file, '' for anything else.
export function zipPathFor(key, name) {
  if (!hasPart(key) || typeof name !== 'string' || !PLAIN_NAME_RE.test(name)) return '';
  return `${PART_BY_KEY[key].folder}/${name}`;
}

// A path inside the zip: a plain name at the top, or one folder deep in a
// part's folder. Nothing that could climb out of where it's unpacked.
export const ZIP_PATH_RE = /^(?:\d{2}-[a-z]+\/)?[A-Za-z0-9][A-Za-z0-9._()+-]{0,99}$/;

export function isZipPath(p) {
  return typeof p === 'string' && p.length <= HANDOVER_LIMITS.path && ZIP_PATH_RE.test(p) && !p.includes('..');
}

// Every zip path a run may produce for these inputs: the root files, the
// brand board when it was sent, the generated text files of `generated`
// (keys of GENERATED_ZIP_FILES whose source went in), and each kit file
// sent or skipped (a skipped one can only be listed as left out).
// `kitFiles` are [{ key, name }].
export function expectedZipPaths({ kitFiles = [], generated = [], board = false } = {}) {
  const out = new Set(ZIP_ROOT_FILES);
  if (board) out.add(zipPathFor('brand', BRAND_BOARD_FILE));
  for (const key of generated) {
    if (Object.prototype.hasOwnProperty.call(GENERATED_ZIP_FILES, key)) out.add(zipPathFor(key, GENERATED_ZIP_FILES[key]));
  }
  for (const f of kitFiles) {
    const p = zipPathFor(f?.key, f?.name);
    if (p) out.add(p);
  }
  return out;
}

// The zip's files grouped as the view lists them: the top first, then one
// group per part. Unknown folders are left out.
export function zipGroups(paths) {
  const groups = [
    { id: 'root', folder: '', label: 'Start here', files: [] },
    ...ZIP_PARTS.map((p) => ({ id: p.key, folder: p.folder, label: p.label, files: [] })),
  ];
  for (const path of Array.isArray(paths) ? paths : []) {
    if (!isZipPath(path)) continue;
    const slash = path.indexOf('/');
    const folder = slash < 0 ? '' : path.slice(0, slash);
    const group = groups.find((g) => g.folder === folder);
    if (group) group.files.push({ path, name: slash < 0 ? path : path.slice(slash + 1) });
  }
  return groups.filter((g) => g.files.length);
}

// Every non-JSON output of the parts the zip carries, as "key/name": the
// skill's data/kit_files.json describes each one (handover.test.js checks).
export function zipKitOutputs() {
  return KIT_SKILLS.filter((s) => hasPart(s.key)).flatMap((s) => zipFileNames(s.key).map((name) => `${s.key}/${name}`));
}

// ─── handover.json ────────────────────────────────────────────────────

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Text on one line, capped (control characters and whitespace runs become
// one space; the skill's common.one_line applies the same rule, checked
// against the shared cases in the skill's tests/one_line_cases.json).
export function oneLine(v, max) {
  if (typeof v !== 'string') return '';
  let s = v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  // A cut through an emoji would leave half of it (a lone surrogate).
  if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1);
  return s;
}

const count = (v, max = 100000) => {
  const n = Number(v);
  return typeof v !== 'boolean' && v !== null && v !== '' && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

export const HANDOVER_LINK_KEYS = Object.freeze(['site', 'booking', 'review', 'signIn']);
const LINK_RE = /^https?:\/\/[^\s"'<>\\]+$/i;

function cleanLink(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length <= HANDOVER_LIMITS.link && LINK_RE.test(s) ? s : '';
}

// Untrusted handover.json (from the skill's container) as the stored data,
// or null when it isn't a handover (not an object, another version, no
// sections).
//   zipPaths  Set of the zip paths these inputs can produce
//             (expectedZipPaths); without it any plain zip path is kept
//   links     { site, booking, review, signIn } as the server built them;
//             a link that isn't exactly the one given for its key becomes ''
export function sanitizeHandover(raw, { zipPaths = null, links = null } = {}) {
  if (!isObject(raw)) return null;
  if (raw.version !== undefined && Number(raw.version) !== HANDOVER_VERSION) return null;
  const L = HANDOVER_LIMITS;

  // The PDF's section titles come from the contract, so any other text is
  // not one of them.
  const sections = [];
  for (const s of Array.isArray(raw.sections) ? raw.sections : []) {
    const t = oneLine(s, L.section);
    if (SECTION_TITLES.has(t) && !sections.includes(t)) sections.push(t);
    if (sections.length >= L.sections) break;
  }
  if (!sections.length) return null;

  const allowed = (p) => isZipPath(p) && (!zipPaths || zipPaths.has(p));
  const files = [];
  for (const f of Array.isArray(raw.files) ? raw.files : []) {
    if (allowed(f) && !files.includes(f)) files.push(f);
    if (files.length >= L.files) break;
  }

  const left = [];
  for (const l of Array.isArray(raw.left) ? raw.left : []) {
    if (!isObject(l) || !allowed(l.file) || files.includes(l.file) || left.some((x) => x.file === l.file)) continue;
    left.push({ file: l.file, reason: oneLine(l.reason, L.reason) || 'Left out of the zip' });
    if (left.length >= L.left) break;
  }

  const rawLinks = isObject(raw.links) ? raw.links : {};
  const outLinks = {};
  for (const k of HANDOVER_LINK_KEYS) {
    const v = cleanLink(rawLinks[k]);
    outLinks[k] = v && (!links || v === cleanLink(links[k])) ? v : '';
  }

  const thisWeek = [];
  for (const t of Array.isArray(raw.thisWeek) ? raw.thisWeek : []) {
    if (!isObject(t)) continue;
    const title = oneLine(t.title, L.title);
    const detail = oneLine(t.detail, L.detail);
    if (title) thisWeek.push({ title, detail });
    if (thisWeek.length >= L.thisWeek) break;
  }

  const checklist = [];
  for (const c of Array.isArray(raw.checklist) ? raw.checklist : []) {
    if (!isObject(c)) continue;
    const week = count(c.week, L.weeks);
    const task = oneLine(c.task, L.task);
    if (week && task) checklist.push({ week, task });
    if (checklist.length >= L.checklist) break;
  }
  // Stable: tasks keep their order within a week.
  checklist.sort((a, b) => a.week - b.week);

  let claims = null;
  if (isObject(raw.claims)) {
    const c = { checked: count(raw.claims.checked), sourced: count(raw.claims.sourced), toConfirm: count(raw.claims.toConfirm), listed: count(raw.claims.listed) };
    if (Object.values(c).every((v) => v !== null)) claims = c;
  }

  return {
    version: HANDOVER_VERSION,
    summary: oneLine(raw.summary, L.summary),
    sections,
    pages: count(raw.pages, L.pages) || 0,
    files,
    left,
    links: outLinks,
    thisWeek,
    checklist,
    claims,
    notes: (Array.isArray(raw.notes) ? raw.notes : []).map((n) => oneLine(n, L.note)).filter(Boolean).slice(0, L.notes),
  };
}

// ─── For the view ─────────────────────────────────────────────────────

export const HANDOVER_LINK_LABELS = Object.freeze({
  site: 'Website',
  booking: 'Booking page',
  review: 'Google review link',
  signIn: 'Sign-in page',
});

// The links the PDF prints, as [{ key, label, url }] (empty ones left out).
export function handoverLinks(data) {
  const links = isObject(data?.links) ? data.links : {};
  return HANDOVER_LINK_KEYS.map((key) => ({ key, label: HANDOVER_LINK_LABELS[key], url: cleanLink(links[key]) })).filter((l) => l.url);
}

// "3 of 14 statements are listed for the customer to confirm." / "All 14
// statements trace back to what the customer told us." / '' without a
// ledger.
export function claimsLine(claims) {
  if (!isObject(claims)) return '';
  if (!claims.checked) return 'The claims ledger had no statements to check.';
  if (!claims.toConfirm) return `All ${claims.checked} statements trace back to what the customer told us.`;
  const s = claims.toConfirm === 1 ? 'statement is' : 'statements are';
  return `${claims.toConfirm} of ${claims.checked} ${s} listed for the customer to confirm${claims.listed < claims.toConfirm ? ` (${claims.listed} printed)` : ''}.`;
}

// The checklist as [{ week, tasks: [task] }], weeks 1-4 that have tasks.
export function checklistByWeek(checklist) {
  const out = [];
  for (const c of Array.isArray(checklist) ? checklist : []) {
    if (!isObject(c) || !c.task) continue;
    let w = out.find((x) => x.week === c.week);
    if (!w) {
      w = { week: c.week, tasks: [] };
      out.push(w);
    }
    w.tasks.push(c.task);
  }
  return out.sort((a, b) => a.week - b.week);
}
