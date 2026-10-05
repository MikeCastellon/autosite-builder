// "Build brand system" (Admin > Custom websites > Design setup): Claude runs
// the launch-brand-system skill over the customer's logo, brand files,
// reference screenshots and style answers, and comes back with a brand
// system: the 5 color roles plus light and dark alternates, a heading/body
// pair from FONT_CATALOG, and a brand board image. The run and its result
// live in custom_site_projects.design.brand and only the server writes them
// (netlify/functions/custom-site-brand); src/lib/brandSpec.js validates what
// the skill produced. Nothing here touches a site: the admin applies one of
// the palettes and the fonts to the Studio's levers (BrandSystemCard) and
// saves the setup as usual.
//
// This module is the browser's side of custom-site-brand plus the pure
// helpers the card renders with (customSiteBrand.test.js). The contract
// itself (palette shape, readability pairs, stale runs, body fonts) is
// brandSpec.js's; these helpers read through it so the card can't disagree
// with what the server stored.
//
// What custom-site-brand answers (POST, super-admin sign-in):
//   start { id }  → { brand: <design.brand>, startedAt }; 409 { error, brand }
//                   while a run is live
//   get   { id }  → { brand: <design.brand> | null, boardUrl }, boardUrl a
//                   short-lived signed link to brand.boardPath (null without)
// Either action may answer { configured: false, error } (any status, or
// code 'not_configured') while the skill id/version env vars are unset: the
// card shows "Not set up yet" instead of an error.
import { supabase } from './supabase.js';
import { BRAND_BODY_FONTS, BRAND_HEADING_FONTS, brandContrast, brandPaletteOf, isBrandClaimStale } from './brandSpec.js';
import { COLOR_ROLES } from './designLevers.js';
import { contrastRatio } from '../components/preview/templates/kit/theme.js';

export const BRAND_FN = '/.netlify/functions/custom-site-brand';
// How often the card asks while a run is going.
export const BRAND_POLL_MS = 5000;

const TEXT_MIN = 4.5;
const HEX = /^#[0-9a-f]{6}$/i;
// custom-site-skills.js throws runError(..., { code: 'not_configured' })
// when the skill id env var is unset.
const NOT_SET_UP_CODES = ['not_configured'];

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Server text on one line, capped: reasons and errors come from the model.
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// ─── Server calls ─────────────────────────────────────────────────────

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Did the server say the skill isn't set up? Checked on failures too: a
// missing env var is a state to show, not an error to retry.
export function isNotSetUp(data) {
  return isObject(data) && (data.configured === false || NOT_SET_UP_CODES.includes(data.code));
}

// The board link, only when it is a web address an <img> may load (a
// signed storage URL; plain http only for a local Supabase).
export function safeBoardUrl(url) {
  const s = typeof url === 'string' ? url.trim() : '';
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s"'<>]*$/i.test(s)) return s;
  return '';
}

// A design.brand record: anything with a status string.
function runRecord(v) {
  return isObject(v) && typeof v.status === 'string' ? v : null;
}

// One answer from custom-site-brand, as the card uses it:
//   { configured, run, boardUrl, alreadyRunning, message }
// `run` is the design.brand record (null before the first run). A start
// that only sent its startedAt back counts as a running record, so the card
// starts polling at once.
export function brandResponse(data, { status = 200 } = {}) {
  const d = isObject(data) ? data : {};
  const configured = !isNotSetUp(d);
  let run = runRecord(d.brand) || runRecord(d.run);
  if (!run && configured && status < 300 && typeof d.startedAt === 'string' && d.startedAt) {
    run = { status: 'running', startedAt: d.startedAt };
  }
  return {
    configured,
    run,
    boardUrl: safeBoardUrl(d.boardUrl),
    alreadyRunning: status === 409,
    message: configured ? '' : oneLine(d.error, 300),
  };
}

async function call(action, projectId) {
  if (typeof projectId !== 'string' || !projectId) throw new Error('No project');
  const headers = await authHeaders();
  let res;
  try {
    res = await fetch(BRAND_FN, { method: 'POST', headers, body: JSON.stringify({ action, id: projectId }) });
  } catch {
    throw Object.assign(new Error('Can\'t reach the server. Check your connection and try again.'), { offline: true });
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  // "Not set up" and "already running" are answers, not failures.
  if (res.ok || res.status === 409 || isNotSetUp(data)) return brandResponse(data, { status: res.status });
  throw Object.assign(new Error(oneLine(data?.error, 300) || `Request failed (${res.status})`), { status: res.status, data });
}

// Claims a run and starts it on the server. Resolves to brandResponse().
export function startBrandRun(projectId) {
  return call('start', projectId);
}

// The current run (a run that died shows as failed) and a fresh signed
// link to its board. Resolves to brandResponse().
export function getBrandRun(projectId) {
  return call('get', projectId);
}

// ─── Run state ────────────────────────────────────────────────────────

function startedMs(run) {
  const ms = Date.parse(run?.startedAt || '');
  return Number.isFinite(ms) ? ms : NaN;
}

// What the card shows for design.brand:
//   idle     no run yet
//   running  a run is going
//   stale    "running" for longer than a run can take (brandSpec's
//            isBrandClaimStale; the server's `get` turns it into failed too)
//   ready    done, with a palette to show
//   failed   failed, or "ready" without a usable palette
export function brandRunState(run, nowMs = Date.now()) {
  const r = runRecord(run);
  if (!r) return 'idle';
  if (r.status === 'running') return isBrandClaimStale(r, nowMs) ? 'stale' : 'running';
  if (r.status === 'ready') return brandPaletteOf(r.brand?.palette) ? 'ready' : 'failed';
  if (r.status === 'failed') return 'failed';
  return 'idle';
}

// The error to show for a failed run.
export function brandRunError(run) {
  const r = runRecord(run);
  if (r?.status === 'ready' && !brandPaletteOf(r.brand?.palette)) return 'The brand system came back without a usable palette.';
  return oneLine(r?.error, 400) || 'Something went wrong.';
}

// What the run left out or warned about, as lines for the card:
// skipped uploads ({ name, kind, reason }) and warnings (text).
export function brandRunNotes(run) {
  const r = runRecord(run) || {};
  const skipped = (Array.isArray(r.skipped) ? r.skipped : []).map((s) => {
    if (typeof s === 'string') return oneLine(s, 300);
    const name = oneLine(s?.name, 120) || oneLine(s?.path, 120).split('/').pop() || 'A file';
    const reason = oneLine(s?.reason, 200);
    return reason ? `${name}: ${reason}` : name;
  }).filter(Boolean).slice(0, 10);
  const warnings = (Array.isArray(r.warnings) ? r.warnings : [])
    .map((w) => oneLine(typeof w === 'string' ? w : w?.message, 300)).filter(Boolean).slice(0, 10);
  return { skipped, warnings };
}

const FINISHED = { ready: 2, failed: 2, running: 1 };

// The newer of two design.brand records: the project the page loaded and
// the one the card fetched since. A later start wins; for the same run, a
// finished record beats the "running" one it replaced.
export function newerBrandRun(a, b) {
  const x = runRecord(a);
  const y = runRecord(b);
  if (!x || !y) return x || y;
  const tx = startedMs(x);
  const ty = startedMs(y);
  if (Number.isFinite(tx) && Number.isFinite(ty) && tx !== ty) return ty > tx ? y : x;
  if (Number.isFinite(tx) !== Number.isFinite(ty)) return Number.isFinite(ty) ? y : x;
  return (FINISHED[y.status] || 0) > (FINISHED[x.status] || 0) ? y : x;
}

// ─── The brand system ────────────────────────────────────────────────

const samePalette = (a, b) => !!a && !!b && COLOR_ROLES.every((role) => a[role] === b[role]);

// The brand's fonts as brandToLevers applies them: catalog families, and a
// body face that reads at paragraph size ('' for a slot without one).
export function brandFonts(spec) {
  const pick = (v, list) => (typeof v === 'string' && list.includes(v) ? v : '');
  return { heading: pick(spec?.fonts?.heading, BRAND_HEADING_FONTS), body: pick(spec?.fonts?.body, BRAND_BODY_FONTS) };
}

// The palettes the admin can pick from: the recommended one, then the
// light and dark alternates. An alternate that is missing, broken or the
// same as one already listed is left out. `which` is what brandToLevers()
// takes for it (undefined = the main palette).
export function brandChoices(spec) {
  const out = [];
  const add = (id, which, label, hint, raw) => {
    const palette = brandPaletteOf(raw);
    if (palette && !out.some((c) => samePalette(c.palette, palette))) out.push({ id, which, label, hint, palette });
  };
  add('main', undefined, 'Recommended', 'The palette Claude picked', spec?.palette);
  add('light', 'light', 'Light version', 'Light background', spec?.alternates?.light);
  add('dark', 'dark', 'Dark version', 'Dark background', spec?.alternates?.dark);
  return out;
}

// Why Claude picked what it did, trimmed: { palette, accent, fonts }.
export function brandReasons(spec) {
  const r = isObject(spec?.reasons) ? spec.reasons : {};
  return { palette: oneLine(r.palette, 600), accent: oneLine(r.accent, 600), fonts: oneLine(r.fonts, 600) };
}

// What the skill read off the logo: { dominant: [hex], background, hasText }
// or null when it says nothing usable.
export function brandLogo(spec) {
  const l = isObject(spec?.logo) ? spec.logo : null;
  if (!l) return null;
  const dominant = [...new Set((Array.isArray(l.dominant) ? l.dominant : [])
    .filter((h) => typeof h === 'string' && HEX.test(h.trim()))
    .map((h) => h.trim().toLowerCase()))].slice(0, 8);
  const background = ['light', 'dark', 'transparent'].includes(l.background) ? l.background : '';
  const hasText = typeof l.hasText === 'boolean' ? l.hasText : null;
  if (!dominant.length && !background && hasText === null) return null;
  return { dominant, background, hasText };
}

export function brandNotes(spec) {
  return (Array.isArray(spec?.notes) ? spec.notes : []).map((n) => oneLine(n, 300)).filter(Boolean).slice(0, 8);
}

// The contract's four readability pairs as the site paints them
// (brandContrast), plus `adjusted`: the hex shown is under 4.5:1 as stored
// and the site repairs it (deriveTheme nudges text and muted on its own),
// so the swatch and the page differ a little.
//   [{ id, label, ratio, pass, adjusted }]
export function brandContrastChecks(palette) {
  const p = brandPaletteOf(palette);
  if (!p) return [];
  const asStored = { text: [p.text, p.bg], muted: [p.muted, p.bg], surface: [p.text, p.secondary] };
  return brandContrast(p).map((row) => ({
    ...row,
    adjusted: row.pass && !!asStored[row.id] && contrastRatio(...asStored[row.id]) < TEXT_MIN,
  }));
}

const ROLE_NAMES = { bg: 'background', secondary: 'surface / secondary', text: 'text', muted: 'muted text', accent: 'accent' };
const SCOPES = { palette: '', 'alternates.light': 'Light version', 'alternates.dark': 'Dark version' };

// "Accent", "Dark version: surface / secondary", "Light version" (left out
// whole), "Body font" for one of sanitizeBrand's adjustment targets.
function adjustmentLabel(target) {
  if (target === 'fonts.heading') return 'Heading font';
  if (target === 'fonts.body') return 'Body font';
  const m = /^(palette|alternates\.light|alternates\.dark)(?:\.([a-z]+))?$/.exec(target);
  if (!m) return target;
  const scope = SCOPES[m[1]];
  const role = ROLE_NAMES[m[2]] || '';
  if (!role) return scope || 'Palette';
  return scope ? `${scope}: ${role}` : role.charAt(0).toUpperCase() + role.slice(1);
}

// What the server changed or left out after the skill drew the board
// (sanitizeBrand's `adjustments`), so the admin knows where the board image
// and the stored brand differ: [{ what, from, to, reason }].
export function brandAdjustments(spec) {
  const value = (v) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : oneLine(v, 60));
  return (Array.isArray(spec?.adjustments) ? spec.adjustments : [])
    .map((a) => ({ what: adjustmentLabel(oneLine(a?.target, 60)), from: value(a?.from), to: value(a?.to), reason: oneLine(a?.reason, 200) }))
    .filter((a) => a.what && a.reason)
    .slice(0, 20);
}

// ─── Applying it ─────────────────────────────────────────────────────

// design.levers with the brand's palette and fonts in place of the admin's
// picks; every other lever (sections, layouts, facts, Google place) is kept.
// `patch` is brandToLevers()'s { palette, fonts }; `shown` is the choice the
// card shows ({ palette, fonts }). brandSpec owns the conversion; `shown`
// only stands in when the patch has nothing usable, so the button never
// silently does nothing. A brand without fonts leaves the fonts alone.
export function leversWithBrand(levers, patch, shown = {}) {
  const base = isObject(levers) ? levers : {};
  const palette = brandPaletteOf(patch?.palette) || brandPaletteOf(shown?.palette);
  const fromPatch = brandFonts({ fonts: patch?.fonts });
  const fonts = fromPatch.heading || fromPatch.body ? fromPatch : brandFonts({ fonts: shown?.fonts });
  const next = { ...base };
  if (palette) next.palette = palette;
  if (fonts.heading || fonts.body) {
    next.fonts = {};
    if (fonts.heading) next.fonts.heading = fonts.heading;
    if (fonts.body) next.fonts.body = fonts.body;
  }
  return next;
}

// The choice the levers already use (palette and the brand's fonts), or ''.
export function choiceInUse(choices, levers, fonts) {
  const lp = brandPaletteOf(levers?.palette);
  if (!lp) return '';
  const f = brandFonts({ fonts });
  const lf = levers?.fonts || {};
  if ((f.heading && lf.heading !== f.heading) || (f.body && lf.body !== f.body)) return '';
  return (Array.isArray(choices) ? choices : []).find((c) => samePalette(c.palette, lp))?.id || '';
}

// ─── Labels ──────────────────────────────────────────────────────────

const MODEL_FAMILIES = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };

// 'claude-opus-5-5' → 'Claude Opus 5.5'; anything else as given.
export function modelLabel(model) {
  const s = oneLine(model, 80);
  const m = /^claude-(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(s);
  if (!m) return s;
  return `Claude ${MODEL_FAMILIES[m[1]]} ${m[2]}${m[3] ? `.${m[3]}` : ''}`;
}

// "12,345 tokens in, 2,345 out", or '' without usage.
export function usageLabel(usage) {
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
  const input = n(usage?.input_tokens);
  const output = n(usage?.output_tokens);
  if (input === null && output === null) return '';
  const fmt = (v) => (v ?? 0).toLocaleString('en-US');
  return `${fmt(input)} tokens in, ${fmt(output)} out`;
}

// "1:05" since the run started, '' without a start.
export function elapsedLabel(run, nowMs = Date.now()) {
  const started = startedMs(run);
  if (!Number.isFinite(started)) return '';
  const s = Math.max(0, Math.floor((nowMs - started) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
