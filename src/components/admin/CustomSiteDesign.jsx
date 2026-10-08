import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';
import { TEMPLATES } from '../../data/templates.js';
import { captureReference, customSiteAdmin, importAssetToSite, startDesignRun } from '../../lib/customSites.js';
import {
  CAPTURE_POLL_MS, DESIGN_MODEL, DESIGN_STALE_MS, REFERENCE_SITES_MAX, REFERENCE_SITE_NOTE_MAX, REFERENCE_SITE_URL_MAX, REPLICA_LABEL,
  SITE_BUSINESS_TYPES, brandAccent, canMatchReference, captureViewFor, capturedShotKey, designFromIntake, designProblems, isCaptureLive,
  isImportable, newerCapture, rankTemplates, referenceSiteKey, referenceSiteUrl, replacedShotSource, replicaTemplatesFor, sameReferenceSource,
  sanitizeReference, sanitizeReferenceSites, showsPrices,
} from '../../lib/customSiteDesign.js';
import { formatBytes, safeHref } from '../../lib/customSiteForm.js';
import { changedLeverGroups, leverGroupsChanged, sanitizeLevers } from '../../lib/designLevers.js';
import { featureRows, outlineFontsText, outlineSectionsText } from '../../lib/referenceFeatures.js';
import { unpackGeneratedContent } from '../../lib/siteRender.js';
import { supabase } from '../../lib/supabase.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { formatDateTime } from './customSiteUi.jsx';
import { slotImages } from './studio/designPreview.js';

// The Design Studio loads only when an admin opens the setup page: these
// stay out of the bundle every visitor downloads.
const BrandSystemCard = lazy(() => import('./studio/BrandSystemCard.jsx'));
const DesignPreview = lazy(() => import('./studio/DesignPreview.jsx'));
const FactsField = lazy(() => import('./studio/FactsField.jsx'));
const FontField = lazy(() => import('./studio/FontField.jsx'));
const GooglePlaceField = lazy(() => import('./studio/GooglePlaceField.jsx'));
const LayoutField = lazy(() => import('./studio/LayoutField.jsx'));
const LooksPicker = lazy(() => import('./studio/LooksPicker.jsx'));
const PaletteField = lazy(() => import('./studio/PaletteField.jsx'));
const ReferenceShotUpload = lazy(() => import('./studio/ReferenceShotUpload.jsx'));
const SectionsField = lazy(() => import('./studio/SectionsField.jsx'));
const SuggestPanel = lazy(() => import('./studio/SuggestPanel.jsx'));
const Loading = () => <p className="text-[13px] text-ink-tertiary">Loading…</p>;

// The Design step of a custom website project: the card on the project page
// (state of the build and what to do next) and the full-page setup where the
// admin confirms the details, picks the look and photos, and has Claude write
// the site. See src/lib/customSiteDesign.js.

const MODEL_NAME = DESIGN_MODEL === 'claude-opus-5-5' ? 'Claude Opus 5.5' : DESIGN_MODEL;
const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/[0.12] text-sm bg-white focus:outline-none focus:border-[#cc0000]';
const ALL_TEMPLATES = Object.values(TEMPLATES);

function templateById(id) {
  return ALL_TEMPLATES.find((t) => t.id === id) || null;
}

// Starts a copy-writing run: the server claims it, then the background
// function runs it. Returns the claimed project.
export async function generateDesign(projectId) {
  const res = await customSiteAdmin('design-generate', { id: projectId });
  try {
    await startDesignRun(projectId, res.startedAt);
  } catch (e) {
    // Give the claim up so the project doesn't sit at "generating".
    await customSiteAdmin('design-release', { id: projectId, startedAt: res.startedAt, error: e.message }).catch(() => {});
    throw e;
  }
  return res.project;
}

// ─── Card on the project page ────────────────────────────────────────

export function DesignCard({ project, onReload, onSetup, onOpenEditor, onOpenBookingSettings }) {
  const { toast } = useAlert();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const status = project.design_status || 'none';
  const site = project.site || null;
  const first = project.client_first_name || 'the customer';
  const handedOver = !!project.handed_over_at;
  const template = templateById(site?.templateId || project.design?.templateId);

  // While Claude writes, check every few seconds.
  useEffect(() => {
    if (status !== 'generating') return undefined;
    const poll = setInterval(() => onReload?.(), 5000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [status, onReload]);

  async function retry() {
    setBusy(true);
    try {
      await generateDesign(project.id);
      onReload?.();
    } catch (e) {
      toast(e.message || 'Could not start', 'error');
    } finally {
      setBusy(false);
    }
  }

  function openEditor() {
    onOpenEditor?.(site.id);
  }

  const elapsed = project.design_started_at ? Math.max(0, Math.round((Date.now() - Date.parse(project.design_started_at)) / 1000)) : 0;
  void tick;

  return (
    <section className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">Design</h3>
        {template && <span className="text-[12px] text-ink-tertiary">Template: {template.label}</span>}
        {site && !handedOver && <span className="ml-auto text-[11px] font-semibold text-ink-tertiary">In your account until hand-over</span>}
      </div>

      {status === 'generating' ? (
        <div className="flex items-center gap-4 rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-4" role="status">
          <span className="w-6 h-6 border-[3px] border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />
          <div>
            <p className="text-[14px] font-semibold text-[#1a1a1a]">{MODEL_NAME} is writing {first}'s site…</p>
            <p className="text-[12px] text-ink-tertiary">
              Usually 1–3 minutes. You can leave this page; it keeps going. {elapsed > 0 && `(${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')})`}
            </p>
            {elapsed > 10 * 60 && elapsed * 1000 <= DESIGN_STALE_MS && (
              <p className="mt-1 text-[12px] text-amber-800">Taking longer than usual. It stops by itself after 16 minutes, then you can try again.</p>
            )}
            {elapsed * 1000 > DESIGN_STALE_MS && (
              <button type="button" onClick={retry} disabled={busy} className={`${BTN_PRIMARY} mt-2`}>{busy ? 'Starting…' : 'Try again'}</button>
            )}
          </div>
        </div>
      ) : status === 'failed' ? (
        <div className="rounded-xl bg-[#fff5f5] border border-[#cc0000]/20 px-4 py-3.5">
          <p className="text-[14px] font-semibold text-[#cc0000]">The copy didn't get written</p>
          <p className="mt-0.5 text-[13px] text-[#4a4a4a]">{project.design_error || 'Something went wrong.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={retry} disabled={busy} className={BTN_PRIMARY}>{busy ? 'Starting…' : 'Try again'}</button>
            <button type="button" onClick={onSetup} className={BTN}>Edit details</button>
          </div>
        </div>
      ) : site ? (
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="text-[#1a1a1a] font-semibold">{site.name || project.business_name || 'Site'}</span>
            {site.publishedUrl
              ? <a href={site.publishedUrl} target="_blank" rel="noreferrer" className="text-[#cc0000] font-semibold hover:underline break-all">{site.publishedUrl.replace(/^https?:\/\//, '')}</a>
              : <span className="text-ink-tertiary">Not published yet: open the editor and press Publish to get a draft link.</span>}
          </div>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            {handedOver ? `In ${site.ownerEmail || project.client_email}'s account since ${formatDateTime(project.handed_over_at)}.` : `Last written ${formatDateTime(project.design_finished_at)}.`}
            {site.schedulerEnabled ? ' Bookings are on.' : ''}
          </p>
          {handedOver ? (
            <p className="mt-3 text-[12px] text-[#4a4a4a]">
              To change it now, sign in as them: Admin › Customers › their account › View as user. Edits made from your own account would move the site back to you.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={openEditor} className={BTN_PRIMARY}>Open in editor</button>
              <button type="button" onClick={() => onOpenBookingSettings?.(site.id)} className={BTN}>Booking settings</button>
              <button type="button" onClick={onSetup} className={BTN}>Edit details &amp; rewrite</button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <p className="min-w-0 flex-1 text-[14px] text-[#4a4a4a]">
            Build the site from {first}'s answers: confirm the details, pick the look and photos, and {MODEL_NAME} writes every page.
            {!project.form_submitted_at && ' They haven\'t sent the form yet, so start with what you have or wait for it.'}
          </p>
          <button type="button" onClick={onSetup} className={project.form_submitted_at ? BTN_PRIMARY : BTN}>Set up the design</button>
        </div>
      )}
    </section>
  );
}

// ─── Full-page setup ─────────────────────────────────────────────────

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-ink-tertiary">{hint}</span>}
    </label>
  );
}

function Section({ title, intro, children, id }) {
  return (
    <section id={id} className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <h3 className="text-[16px] font-[800] text-[#1a1a1a]">{title}</h3>
      {intro && <p className="mt-0.5 text-[13px] text-ink-tertiary">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const SLOT_LABELS = { logo: 'Logo', hero: 'Hero (top of the page)', about: 'About section' };
// Suggest a design's section, which a copy brings into view.
const SUGGEST_SECTION_ID = 'design-suggest';

// ─── Reference sites (design.reference, customSiteDesign.js) ─────────

// A replica template for this project is in this build, so the request is
// done: it saves as ready, naming the replica in use (else the first one).
function withBuiltReplica(reference, replicas, templateId) {
  if (!replicas.length) return reference;
  const known = (id) => replicas.some((t) => t.id === id);
  const id = known(templateId) ? templateId : known(reference.replica.templateId) ? reference.replica.templateId : replicas[0].id;
  return { ...reference, replica: { ...reference.replica, status: 'ready', templateId: id } };
}

const shortUrl = (href) => href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

// The reference files as the list shows them, in upload order: one entry
// per screenshot, the parts of a cut-up one (ReferenceShotUpload gives
// them one `group`, numbered from the top by `part`) together, top first.
// The server checks group and part; this only needs them to be there.
function shotGroups(files) {
  const out = [];
  const byGroup = new Map();
  for (const f of files) {
    if (f.kind !== 'reference') continue;
    const group = typeof f.group === 'string' && f.group && Number.isInteger(f.part) ? f.group : '';
    if (!group) { out.push([f]); continue; }
    if (byGroup.has(group)) { byGroup.get(group).push(f); continue; }
    const parts = [f];
    byGroup.set(group, parts);
    out.push(parts);
  }
  return out.map((parts) => (parts.length > 1 ? [...parts].sort((a, b) => a.part - b.part) : parts));
}

// "home (part 1 of 3).jpg" → "home.jpg": the screenshot the parts came
// from (studio/referenceMatch.js tileName names them; its wholeShotName is
// the same rule, kept apart so this page doesn't load the match code).
const wholeName = (name) => String(name || 'Screenshot').replace(/ \(part \d+ of \d+\)(?=\.[a-z0-9]{1,5}$)/i, '');

// The screenshots a matched address is matched from, as the list says
// it: the parts of one cut-up screenshot count as one screenshot.
function urlShotsText(shots) {
  const n = shots.length;
  const whole = new Set(shots.map((s) => (typeof s.group === 'string' && s.group ? s.group : s.path))).size;
  const screenshots = whole === 1 ? 'its screenshot' : `its ${whole} screenshots`;
  if (whole === n) return n === 1 ? screenshots : `${screenshots}, top first`;
  return `${screenshots} in ${n} parts, top first`;
}

// ─── Server screenshots of an address (design.capture) ───────────────

// Asks `load` every `intervalMs` until the returned stop is called, and
// hands each answer to `onResult`, never after the stop (a request still
// out when the page goes lands nowhere). One ask at a time: a slow answer
// skips the ticks it overlaps. A failed ask (a network blip) is dropped and
// the next tick asks again. `onTick` hears every tick, answered or not: the
// page judges a run against its clock, so a run nobody can reach any more
// (offline, signed out, the project deleted) still turns stale after the
// live window and the polls stop.
export function watchCapture({ load, onResult, onTick, intervalMs = CAPTURE_POLL_MS }) {
  let stopped = false;
  let asking = false;
  const timer = setInterval(() => {
    onTick?.();
    if (asking) return;
    asking = true;
    Promise.resolve()
      .then(load)
      .then((result) => { if (!stopped) onResult(result); })
      .catch(() => {})
      .finally(() => { asking = false; });
  }, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// Polls while a capture is live: the page renders it only then, so the
// polls stop when the run ends or the page goes. Each tick uses the page's
// latest handlers (they read its current state).
function CaptureWatch({ load, onResult, onTick }) {
  const latest = useRef({ load, onResult, onTick });
  latest.current = { load, onResult, onTick };
  useEffect(() => watchCapture({
    load: () => latest.current.load(),
    onResult: (result) => latest.current.onResult(result),
    onTick: () => latest.current.onTick?.(),
  }), []);
  return null;
}

const BTN_SMALL = 'inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_SMALL_PRIMARY = 'inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-[#cc0000] hover:bg-[#a80000] text-[12px] font-bold text-white disabled:opacity-50 transition-colors';
const LINK_BTN = 'text-[12px] font-semibold text-[#cc0000] hover:underline disabled:opacity-50';

// ─── What our server read from a reference's code (its outline) ──────

const SUPPORT_MARKS = {
  have: { mark: '✓', sr: 'We have it:', className: 'text-emerald-700' },
  covered: { mark: '✓', sr: 'We cover it:', className: 'text-emerald-700' },
  'other-template': { mark: '↗', sr: 'In another template:', className: 'text-amber-700' },
  missing: { mark: '✗', sr: 'Not yet:', className: 'text-ink-tertiary' },
};
// Features listed before "Show N more".
const FEATURES_SHOWN = 6;

function featureLine(row) {
  const m = SUPPORT_MARKS[row.status] || SUPPORT_MARKS.missing;
  return (
    <p key={row.id} className="flex gap-1.5">
      <span aria-hidden="true" className={`w-3 shrink-0 font-bold ${m.className}`}>{m.mark}</span>
      <span>
        <span className="sr-only">{m.sr} </span>
        {row.label}{row.provider ? ` (${row.provider})` : ''}
        <span className="text-ink-tertiary"> · {row.text}</span>
      </span>
    </p>
  );
}

// Under a reference our server captured: its fonts, its sections top to
// bottom and the features found in its code, each against what we do for
// the setup's template (referenceFeatures.js). Measured data: none of its
// words go into the site. Nothing without an outline.
function codeOutline(outline, templateId) {
  if (!outline) return null;
  const fonts = outlineFontsText(outline);
  const sections = outlineSectionsText(outline);
  const rows = featureRows(outline.features, templateId);
  if (!fonts && !sections && !rows.length) return null;
  return (
    <div className="mt-2 rounded-lg bg-[#faf9f7] border border-black/[0.06] px-3 py-2 text-[12px] text-[#4a4a4a] space-y-0.5" data-code-outline="">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">From its code</p>
      {fonts && <p><span className="font-semibold text-[#1a1a1a]">Fonts:</span> {fonts}</p>}
      {sections && <p><span className="font-semibold text-[#1a1a1a]">Sections:</span> {sections}</p>}
      {rows.length > 0 && (
        <div>
          <p className="font-semibold text-[#1a1a1a]">Features on this site</p>
          {rows.slice(0, FEATURES_SHOWN).map(featureLine)}
          {rows.length > FEATURES_SHOWN && (
            <details>
              <summary className="cursor-pointer select-none font-semibold text-[#4a4a4a] hover:text-[#1a1a1a]">Show {rows.length - FEATURES_SHOWN} more</summary>
              {rows.slice(FEATURES_SHOWN).map(featureLine)}
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─── "Copy this site's layout" (one click per reference) ─────────────

// The note's address ("Screenshot of <url>", as our capture and
// ReferenceShotUpload write it) of a reference file, as a site key, or ''.
function shotNoteKey(asset) {
  const note = typeof asset?.note === 'string' ? asset.note : '';
  return note.startsWith('Screenshot of ') ? referenceSiteKey(note.slice(14).split(/\s+/)[0]) : '';
}

// How a copy of an address gets its screenshots: 'wait' (our server is
// taking them now), 'match' (it has some: from a capture whose last run
// didn't fail and that read the page's code, or, after a failed one, ones
// the admin uploaded instead, so a site our server can't open never loops)
// or 'capture' (none yet, the last capture failed, or it was taken before
// captures read the code: its part 1 has no outline, and a copy should
// match with one). `view` is captureViewFor the address, `failedStart`
// why its last start failed, `assets` the project's files.
export function copyCapturePlan({ view, failedStart = '', assets = [], key }) {
  if (view?.state === 'running') return 'wait';
  const shots = (Array.isArray(assets) ? assets : []).filter((a) => a?.kind === 'reference');
  if (failedStart || view?.state === 'failed' || view?.state === 'stale') {
    return shots.some((a) => !capturedShotKey(a) && shotNoteKey(a) === key) ? 'match' : 'capture';
  }
  const captured = shots.filter((a) => capturedShotKey(a) === key);
  return captured.some((a) => a.outline && typeof a.outline === 'object') ? 'match' : 'capture';
}

const COPY_MATCHING = 'Claude is matching its layout (1–3 min)…';
// The line under the button, per step of the copy (DesignSetup copyRun).
function copyStatus(run) {
  switch (run.step) {
    case 'capture': return { busy: true, text: 'Taking screenshots and reading its code…' };
    case 'save': case 'start': case 'matching': return { busy: true, text: COPY_MATCHING };
    case 'ready': return { done: true, text: 'Ready below: check it and press Apply' };
    default:
      // The capture block just below says why the screenshots failed, with
      // "Capture again" and "Upload a screenshot instead".
      if (run.at === 'capture') return { failed: true, text: 'Stopped: its screenshots couldn\'t be taken.' };
      if (run.at === 'matching') return { failed: true, text: `The match didn't finish: ${run.error || 'something went wrong'}` };
      return { failed: true, text: `Stopped: ${run.error || 'something went wrong'}` };
  }
}

// The customer typed the business name: in the prompt the admin pastes
// into Claude Code it stays a plain label (letters, digits, simple
// punctuation), never text that could read as an instruction.
const promptName = (name) => String(name || '').replace(/[^\p{L}\p{N} &'.,-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);

// The sites they listed, the ones the team added by address, and the
// reference screenshots (theirs and ones the team added), each used as
// inspiration or, for one at a time, matched: "Suggest a design" then
// mirrors that reference's layout. Any address can be screenshotted on our
// server (design.capture), so a site can be matched without anyone taking
// screenshots by hand. Below it, the exact-replica request (a custom-only
// template built in the repo).
//
//   files       the project's files (assets with signed links), fresh
//   reference   design.reference as it will be saved (sanitized)
//   urlShots    (source) => the screenshots that picture a matched web
//               address (designSuggest.js referenceShots, the rule the
//               run uses), or null while that module loads
//   teamSites   design.referenceSites as saved (sanitized)
//   capture     the project's last server capture (design.capture), newest
//               record, and nowMs the time it is judged at
//   captureStarting  the address key of a start in progress, or ''
//   captureErrors    { address key: why its last start failed }
//   onChange    (reference) => void, kept in the page until Save
//   onSave      (reference, message) => Promise, saves the page right away
//   onAddSite   (url, note) => Promise<{ ok } | { error }>, saves the page
//               with the site and starts its capture
//   onRemoveSite (url) => Promise, saves the page without it
//   onCapture   (url, note) => Promise, captures an address (again)
//   onShotAdded (asset, row) => void, per screenshot (or part) recorded
//   onShotBusy  (busy) => void, while a pick of screenshots uploads
//   replicas    this project's replica templates in this build
//   outlineOf   (source) => the outline our server read from that
//               reference's code (designSuggest.js referenceOutlineOf), or
//               null while that module loads
//   copyRun     the "Copy this site's layout" run (DesignSetup), or null;
//               copyLocked while one of its steps runs
//   onCopy      (item) => void, starts one
//   uploading   screenshots are uploading on the page
function ReferenceSection({
  project, files, reference, urlShots, replicas, templateId, busy, onChange, onSave, onShotAdded, onShotBusy, onPickTemplate,
  teamSites = [], capture = null, nowMs = Date.now(), captureStarting = '', captureErrors = {}, onAddSite, onRemoveSite, onCapture,
  outlineOf = null, copyRun = null, copyLocked = false, onCopy, uploading = false,
}) {
  const { toast } = useAlert();
  // A copy's steps change the reference and the page: the controls here
  // wait for them as they wait for a save.
  const locked = !!busy || copyLocked;
  const first = project.client_first_name || 'the customer';
  const form = project.form || {};
  // The note for a request not yet made (a saved request keeps its own).
  const [note, setNote] = useState(reference.replica.note || '');
  // The add-a-site box.
  const [siteUrl, setSiteUrl] = useState('');
  const [siteNote, setSiteNote] = useState('');
  const [siteError, setSiteError] = useState('');
  const [adding, setAdding] = useState(false);
  // "Upload a screenshot instead" on a site: the uploader labels what it
  // adds as that site's screenshots (else as the matched address's).
  const [uploadFor, setUploadFor] = useState('');
  // Each item's radio pair is its own group; one id keeps the names unique.
  const group = useId();
  const uploaderId = `${group}-upload`;

  const intakeSites = (Array.isArray(form.referenceSites) ? form.referenceSites : [])
    .filter((r) => r && (r.url || r.note))
    .map((r, i) => {
      const href = safeHref(r.url);
      return {
        key: `site-${i}`, kind: 'url', title: href ? shortUrl(href) : String(r.url || 'No address given'), href, note: r.note || '',
        source: href ? { kind: 'url', url: href } : null,
        why: href ? '' : 'Not a usable web address, so it can only inspire.',
        // The customer's note stays theirs: a capture's screenshots carry
        // only the team's words.
        siteKey: href ? referenceSiteKey(href) : '', captureNote: '',
      };
    });
  const intakeKeys = new Set(intakeSites.map((s) => s.siteKey).filter(Boolean));
  // Sites the team added, after the customer's. One the customer listed
  // too shows once, as theirs (the add box refuses those anyway).
  const addedSites = teamSites
    .map((s) => ({
      key: `team-${referenceSiteKey(s.url)}`, kind: 'url', title: shortUrl(s.url), href: s.url, note: s.note,
      source: { kind: 'url', url: s.url }, why: '', byTeam: true, removable: true,
      siteKey: referenceSiteKey(s.url), captureNote: s.note,
    }))
    .filter((s) => s.siteKey && !intakeKeys.has(s.siteKey));
  const sites = [...intakeSites, ...addedSites];
  const full = teamSites.length >= REFERENCE_SITES_MAX;
  // A capture is going (one at a time per project): no other can start.
  const anyCapturing = isCaptureLive(capture, nowMs);
  const shots = shotGroups(files).map((parts) => {
    const f = parts[0];
    // As the run decides (designSuggest.js): both the name and the stored
    // file must be a format Claude can view.
    const matchable = canMatchReference(f.name || f.path) && canMatchReference(f.path);
    return {
      key: f.path, kind: 'asset', title: parts.length > 1 ? wholeName(f.name) : f.name || 'Screenshot',
      thumb: matchable ? f.url : null, open: f.url, note: f.note || '',
      byTeam: f.addedBy === 'admin',
      parts: parts.length,
      // Matching any part matches the whole screenshot (the run sends its
      // parts top first), so a saved source on a lower part still shows here.
      paths: parts.map((p) => p.path),
      source: matchable ? { kind: 'asset', path: f.path } : null,
      why: matchable ? '' : 'Claude can only look at PNG, JPEG, GIF or WebP images. Add a screenshot in one of those to match it.',
    };
  });
  const items = [...sites, ...shots];
  const matched = reference.mode === 'match'
    ? items.find((it) => (it.paths
      ? !!it.source && reference.source?.kind === 'asset' && it.paths.includes(reference.source.path)
      : sameReferenceSource(it.source, reference.source))) || null
    : null;
  // A matched address is matched through its screenshots (their note names
  // it: ReferenceShotUpload and the server's capture write "Screenshot of
  // <url>"). Claude never opens the site itself.
  const matchedUrl = reference.mode === 'match' && reference.source?.kind === 'url' ? reference.source.url : '';
  const matchedUrlShots = matchedUrl && urlShots ? urlShots(reference.source) : null;
  const sourceLabel = (src) => {
    if (!src) return '';
    if (src.kind === 'url') return shortUrl(src.url);
    const f = files.find((x) => x.path === src.path);
    return f ? (f.group ? wholeName(f.name) : f.name || 'a screenshot') : 'a screenshot';
  };

  // One add, and one capture start, at a time: a start still waiting for
  // its answer would otherwise lose track of which site it is starting.
  const addBlocked = adding || locked || full || !!captureStarting || !siteUrl.trim();
  async function addSite() {
    setSiteError('');
    setAdding(true);
    try {
      const res = await onAddSite?.(siteUrl, siteNote);
      if (res?.error) setSiteError(res.error);
      else if (res?.ok) { setSiteUrl(''); setSiteNote(''); }
    } finally {
      setAdding(false);
    }
  }

  // The uploader is further down this section: point it at the site and
  // bring it into view.
  function uploadInstead(href) {
    setUploadFor(href);
    if (typeof document !== 'undefined') document.getElementById(uploaderId)?.scrollIntoView({ block: 'center' });
  }

  // "Copy this site's layout": one click that takes its screenshots when it
  // needs them, saves the match and starts Suggest a design, with the
  // copy's progress under it (DesignSetup copyLayout). Off while a copy's
  // step runs, while screenshots upload and, when it would capture, while
  // another capture goes (the server takes one at a time).
  function copyBlock(item, view) {
    const run = copyRun?.key === item.key ? copyRun : null;
    const status = run ? copyStatus(run) : null;
    const plan = item.kind === 'url'
      ? copyCapturePlan({ view, failedStart: view?.state === 'running' ? '' : captureErrors[item.siteKey] || '', assets: files, key: item.siteKey })
      : 'match';
    const captureBusy = plan === 'capture' && (anyCapturing || !!captureStarting);
    const title = uploading ? 'Wait for the screenshots to finish uploading.'
      : captureBusy ? 'Another capture is going. Wait for it to finish.'
        : 'Copies its layout only: never its words, photos, logo or brand.';
    return (
      <div className="mt-2">
        <button type="button" onClick={() => onCopy?.(item)} disabled={locked || uploading || captureBusy} title={title} className={BTN_SMALL_PRIMARY}>
          Copy this site's layout
        </button>
        {status && (
          <p
            role={status.failed ? 'alert' : 'status'}
            className={`mt-1.5 flex items-center gap-2 text-[12px] ${status.failed ? 'font-medium text-[#cc0000]' : status.done ? 'font-semibold text-emerald-800' : 'text-[#4a4a4a]'}`}
          >
            {status.busy && <span className="w-3.5 h-3.5 border-2 border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />}
            {status.text}
          </p>
        )}
      </div>
    );
  }

  // Under an address: its capture (going, taken, failed) and the button to
  // take (or retake) its screenshots. A failed one points at the uploader.
  //   view       captureViewFor this address
  //   siteShots  its screenshots (urlShots), or null while those load
  function captureBlock(item, view, siteShots) {
    const failedStart = view.state === 'running' ? '' : captureErrors[item.siteKey] || '';
    const starting = captureStarting === item.siteKey;
    // Taken of this address: a screenshot found by its note may be another
    // site's capture whose note only mentions this one.
    const captured = view.state !== 'none' || (siteShots || []).some((s) => capturedShotKey(s) === item.siteKey);
    const captureButton = (label) => (
      <button
        type="button"
        onClick={() => onCapture?.(item.href, item.captureNote)}
        disabled={locked || anyCapturing || !!captureStarting}
        title={anyCapturing ? 'Another capture is going. Wait for it to finish.' : undefined}
        className={BTN_SMALL}
      >
        {starting ? 'Starting…' : label}
      </button>
    );
    if (view.state === 'running') {
      return (
        <div className="mt-2 flex items-center gap-2.5" role="status">
          <span className="w-4 h-4 border-2 border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />
          <p className="text-[12px] text-[#4a4a4a]">
            <strong className="text-[#1a1a1a]">Capturing…</strong> Our server is taking screenshots of this site, top first. Usually under a minute; you can leave this page.
          </p>
        </div>
      );
    }
    if (failedStart || view.state === 'failed' || view.state === 'stale') {
      const why = failedStart || (view.state === 'stale' ? 'The capture didn\'t finish (it may have timed out).' : view.error || 'Something went wrong.');
      return (
        <div className="mt-2 rounded-lg bg-[#fff5f5] border border-[#cc0000]/20 px-3 py-2">
          <p className="text-[12px] text-[#4a4a4a]"><strong className="text-[#cc0000]">Couldn't capture it.</strong> {why}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {captureButton('Capture again')}
            <button type="button" onClick={() => uploadInstead(item.href)} className={LINK_BTN}>Upload a screenshot instead</button>
          </div>
        </div>
      );
    }
    if (view.state === 'ready') {
      return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[12px] text-emerald-800">
            <strong>Screenshots ready</strong>
            {view.parts > 0 && ` · ${view.parts === 1 ? '1 part' : `${view.parts} parts, top first`}`}
            {view.finishedAt && <span className="text-ink-tertiary"> · {formatDateTime(view.finishedAt)}</span>}
          </p>
          {captureButton('Capture again')}
        </div>
      );
    }
    return <div className="mt-2">{captureButton(captured ? 'Capture again' : 'Capture screenshots')}</div>;
  }

  const replica = reference.replica;
  const name = promptName(project.business_name);
  // The skill (.claude/skills/replica-template) reads the project, its
  // design.reference and the request's note; the prompt repeats the rule.
  const prompt = `Build the exact replica template for custom website project ${project.id}${name ? ` (${name})` : ''}. `
    + 'Copy only its layout, structure, spacing, type feel and component style, never the reference\'s words, photos, logo, brand marks or name.';

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Copied', 'success');
    } catch {
      toast('The browser blocked copying: select the text and copy it', 'error');
    }
  }

  return (
    <Section title="Reference sites" intro={`Sites and screenshots ${first} likes, and ones the team added. Use each one as inspiration, or match one's layout.`}>
      <p className="rounded-lg bg-[#faf9f7] border border-black/[0.06] px-3 py-2 text-[12px] text-[#4a4a4a]">
        <strong className="text-[#1a1a1a]">Layout only.</strong> Matching or replicating a site copies its structure, spacing, type feel and the style of
        its parts. Never its words, photos, logo, icons, business name or anything else that identifies that business: {first}'s own content,
        colors and logo go in.
      </p>

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-tertiary">They didn't list a site or send a screenshot. Add a site's address or a screenshot below to match its layout.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => {
            const on = !!matched && matched.key === item.key;
            // An address: its capture, and its screenshots (the top one
            // shows as its picture).
            const web = item.kind === 'url' && !!item.href;
            const view = web ? captureViewFor(capture, item.href, nowMs) : null;
            const siteShots = web && urlShots ? urlShots(item.source) : null;
            const top = siteShots?.length ? files.find((f) => f.path === siteShots[0].path && f.url) : null;
            const thumb = item.thumb || top?.url || null;
            return (
              <li key={item.key} className={`rounded-xl border p-3 ${on ? 'border-[#cc0000] bg-[#cc0000]/[0.03]' : 'border-black/[0.08]'}`}>
                <div className="flex gap-3">
                  {thumb ? (
                    <a href={item.open || thumb} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={thumb} alt={`Screenshot: ${item.title}`} className="w-20 h-14 rounded-md object-cover object-top border border-black/10" />
                    </a>
                  ) : (
                    <span className="w-20 h-14 shrink-0 rounded-md bg-black/[0.04] flex items-center justify-center text-ink-tertiary" aria-hidden="true">
                      {item.kind === 'url' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
                      ) : (
                        <span className="text-[10px] font-bold uppercase">{(/\.([a-z0-9]{1,5})$/i.exec(item.title)?.[1] || 'file')}</span>
                      )}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1a1a1a] [overflow-wrap:anywhere]">
                      {item.href
                        ? <a href={item.href} target="_blank" rel="noreferrer" className="hover:underline">{item.title}</a>
                        : item.open ? <a href={item.open} target="_blank" rel="noreferrer" className="hover:underline">{item.title}</a> : item.title}
                      {item.parts > 1 && <span className="ml-2 inline-block whitespace-nowrap text-[11px] font-normal text-ink-tertiary">{item.parts} parts, top first</span>}
                      {item.byTeam && <span className="ml-2 inline-block whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">Added by the team</span>}
                      {/* Its screenshots stay (listed below as the team's)
                          until someone deletes them. */}
                      {item.removable && (
                        <button type="button" onClick={() => onRemoveSite?.(item.href)} disabled={locked} aria-label={`Remove ${item.title}`} className={`ml-2 ${LINK_BTN} font-normal`}>
                          Remove
                        </button>
                      )}
                    </p>
                    {item.note && <p className="mt-0.5 text-[12px] text-[#4a4a4a]">{item.byTeam ? 'Note' : 'They wrote'}: "{item.note}"</p>}
                    <fieldset className="mt-2">
                      <legend className="sr-only">How to use {item.title}</legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <label className="inline-flex items-center gap-1.5 text-[12px] text-[#1a1a1a] cursor-pointer">
                          <input
                            type="radio"
                            name={`${group}-${i}`}
                            checked={!on}
                            disabled={copyLocked}
                            onChange={() => { if (on) onChange({ ...reference, mode: 'inspire', source: null }); }}
                            className="w-3.5 h-3.5 accent-[#cc0000]"
                          />
                          Use as inspiration
                        </label>
                        <label className={`inline-flex items-center gap-1.5 text-[12px] ${item.source ? 'text-[#1a1a1a] cursor-pointer' : 'text-ink-tertiary'}`}>
                          <input
                            type="radio"
                            name={`${group}-${i}`}
                            checked={on}
                            disabled={!item.source || copyLocked}
                            // One reference is matched at a time: this replaces any other.
                            onChange={() => onChange({ ...reference, mode: 'match', source: item.source })}
                            className="w-3.5 h-3.5 accent-[#cc0000]"
                          />
                          Match its layout
                        </label>
                      </div>
                    </fieldset>
                    {item.why && <p className="mt-1 text-[11px] text-ink-tertiary">{item.why}</p>}
                    {item.source && copyBlock(item, view)}
                    {web && captureBlock(item, view, siteShots)}
                    {/* What our server read from its code: an address's
                        newest capture, or this captured screenshot's. */}
                    {item.source && outlineOf && (codeOutline(outlineOf(item.source), templateId) || (
                      // Captured before captures read the code: say how to get it.
                      web && (siteShots || []).some((s) => capturedShotKey(s) === item.siteKey) && (
                        <p className="mt-2 text-[11px] text-ink-tertiary" data-outline-missing="">
                          Captured before we read sites' code. Capture again, or press Copy this site's layout, to add its fonts, sections and features.
                        </p>
                      )
                    ))}
                    {on && item.kind === 'url' && matchedUrlShots && (
                      matchedUrlShots.length === 0 ? (
                        <p className="mt-2 text-[12px] text-amber-800">
                          <strong>{view?.state === 'running' ? 'Its screenshots are being taken.' : 'No screenshots of this site yet.'}</strong>{' '}
                          {view?.state === 'running' ? 'It can be matched once they\'re in.' : 'Capture them above, or add one below.'} Claude only ever sees
                          screenshots, never the site itself.
                        </p>
                      ) : (
                        <p className="mt-2 text-[12px] text-[#4a4a4a]">
                          Matched from {urlShotsText(matchedUrlShots)}, labeled
                          "Screenshot of {item.title}". Claude never opens the site itself.
                        </p>
                      )
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {matched && (matched.kind === 'asset' || matchedUrlShots?.length > 0) && (
        <p className="mt-3 text-[12px] text-[#4a4a4a]">
          Suggest a design will mirror <strong>{matched.title}</strong>: the closest template, section order, hero and About layouts, and fonts.
          Colors come from {first}'s side (the Studio palette, else the brand system, else their brand colors), never from the reference, and the
          logo is theirs.
        </p>
      )}
      {reference.mode === 'match' && !matched && (
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
          The reference being matched ({sourceLabel(reference.source)}) isn't in the list or the project's files anymore.{' '}
          <button type="button" onClick={() => onChange({ ...reference, mode: 'inspire', source: null })} disabled={copyLocked} className="font-semibold underline disabled:opacity-50">Stop matching it</button>
        </p>
      )}

      <div className="mt-4 rounded-xl border border-black/[0.08] p-4">
        <p className="text-[13px] font-bold text-[#1a1a1a]">Add a site by its address</p>
        <p className="mt-0.5 text-[12px] text-ink-tertiary">
          Our server opens it and takes screenshots of the page from the top (up to four parts), so you can match it. Only its layout and how
          things work are used, never its words, photos, logo or brand.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            inputMode="url"
            value={siteUrl}
            onChange={(e) => { setSiteUrl(e.target.value); setSiteError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!addBlocked) addSite(); } }}
            placeholder="shopname.com"
            aria-label="Site address"
            maxLength={REFERENCE_SITE_URL_MAX}
            disabled={full}
            className={`${INPUT} sm:flex-[3]`}
          />
          <input
            value={siteNote}
            onChange={(e) => setSiteNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!addBlocked) addSite(); } }}
            placeholder="What to copy (optional), like the hero"
            aria-label="What to copy from it (optional)"
            maxLength={REFERENCE_SITE_NOTE_MAX}
            disabled={full}
            className={`${INPUT} sm:flex-[2]`}
          />
          <button type="button" onClick={addSite} disabled={addBlocked} className={BTN}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {siteError && <p role="alert" className="mt-2 text-[12px] font-medium text-[#cc0000]">{siteError}</p>}
        <p className="mt-1.5 text-[11px] text-ink-tertiary">
          {full ? `The team can add up to ${REFERENCE_SITES_MAX} sites: remove one to add another.` : 'Adding saves this page.'}
        </p>
      </div>

      <div className="mt-4" id={uploaderId}>
        <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">
          {uploadFor ? `Add a screenshot of ${shortUrl(uploadFor)}` : 'Add a screenshot'}
          {uploadFor && <button type="button" onClick={() => setUploadFor('')} className={`ml-2 ${LINK_BTN} font-normal`}>Not of this site</button>}
        </p>
        <Suspense fallback={<Loading />}>
          {/* For a site (its "Upload a screenshot instead"), else with an
              address matched, the upload labels its screenshots as that
              site's ("Screenshot of <url>"), which is how the match finds
              them (a tall one is cut into up to four parts, top first, kept
              together as one group). */}
          <ReferenceShotUpload projectId={project.id} sourceUrl={uploadFor || matchedUrl} onAdded={onShotAdded} onBusy={onShotBusy} disabled={locked} />
        </Suspense>
      </div>

      <div className="mt-5 rounded-xl border border-black/[0.08] p-4">
        <p className="text-[13px] font-bold text-[#1a1a1a]">Exact replica</p>
        <p className="mt-0.5 text-[12px] text-ink-tertiary">
          When matching isn't close enough: Claude builds a new template modeled on the reference you match, for {first} only. It copies the
          layout, never the words, photos, logo or brand. {first}'s content, colors and logo go in.
        </p>

        {replicas.length > 0 ? (
          <div className="mt-3 space-y-2">
            {replicas.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <span className="text-[13px] text-[#1a1a1a]"><strong>Ready:</strong> {t.label} <span className="text-ink-tertiary">({REPLICA_LABEL})</span></span>
                {templateId === t.id
                  ? <span className="ml-auto text-[12px] font-semibold text-emerald-800">In use</span>
                  : <button type="button" onClick={() => onPickTemplate(t.id)} disabled={locked} className={`${BTN} ml-auto`}>Use this template</button>}
              </div>
            ))}
            <p className="text-[11px] text-ink-tertiary">It's also first under Look. Save or write the site to keep a switch.</p>
          </div>
        ) : replica.status === 'none' ? (
          <div className="mt-3">
            <Field label="What should it copy? (optional)" hint="For Claude: the parts to follow closely, like the hero, the services grid or the spacing.">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={`${INPUT} leading-relaxed`} />
            </Field>
            {!reference.source && <p className="mt-2 text-[12px] text-ink-tertiary">First choose Match its layout on the reference to replicate.</p>}
            <button
              type="button"
              disabled={locked || !reference.source}
              onClick={() => onSave({ ...reference, replica: { status: 'requested', requestedAt: new Date().toISOString(), templateId: '', note } }, 'Replica requested')}
              className={`${BTN} mt-3`}
            >
              Request exact replica
            </button>
            <p className="mt-1.5 text-[11px] text-ink-tertiary">Saves this page with the request.</p>
          </div>
        ) : (
          <div className="mt-3 text-[13px]">
            <p className="text-[#1a1a1a]">
              <strong>{replica.status === 'building' ? 'Being built' : replica.status === 'ready' ? 'Marked ready' : 'Requested'}</strong>
              {replica.requestedAt && <span className="text-ink-tertiary"> · {formatDateTime(replica.requestedAt)}</span>}
              {reference.source && <span className="text-ink-tertiary"> · from {sourceLabel(reference.source)}</span>}
            </p>
            {replica.status === 'ready' && (
              <p className="mt-1 text-[12px] text-amber-800">
                The replica template{replica.templateId ? ` (${replica.templateId})` : ''} isn't in this build yet. It shows here once it's deployed.
              </p>
            )}
            {!reference.source && <p className="mt-1 text-[12px] text-amber-800">No reference is matched: choose Match its layout on the one to replicate.</p>}
            {replica.note && <p className="mt-1 text-[12px] text-[#4a4a4a]">Note: {replica.note}</p>}
            <div className="mt-3 rounded-lg bg-[#faf9f7] border border-black/[0.06] px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[#1a1a1a]">Next step: Ask Claude to build the replica template for this project.</p>
              <p className="mt-0.5 text-[12px] text-ink-tertiary">In Claude Code, in the Website Creator repo, paste:</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 [overflow-wrap:anywhere] rounded bg-white border border-black/[0.08] px-2 py-1 text-[12px] text-[#1a1a1a]">{prompt}</code>
                <button type="button" onClick={copyPrompt} className={BTN}>Copy</button>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-tertiary">Once it's deployed, it shows up here and first under Look, for {first} only.</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {replica.status === 'requested' && (
                <button type="button" disabled={locked} onClick={() => onSave({ ...reference, replica: { ...replica, status: 'building' } }, 'Marked as being built')} className={BTN}>
                  Mark as being built
                </button>
              )}
              <button
                type="button"
                disabled={locked}
                onClick={() => { setNote(replica.note || ''); onSave({ ...reference, replica: { status: 'none' } }, 'Replica request cancelled'); }}
                className={BTN}
              >
                Cancel the request
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

export function DesignSetup({ project, onBack, onStarted }) {
  const { toast, confirm } = useAlert();
  const form = project.form || {};
  const saved = project.design && project.design.businessInfo ? project.design : null;
  const start = useMemo(() => {
    const fromIntake = designFromIntake(project);
    if (!saved) return fromIntake;
    return {
      ...fromIntake,
      ...saved,
      businessInfo: { ...fromIntake.businessInfo, ...saved.businessInfo },
      slots: { ...fromIntake.slots, ...(saved.slots || {}) },
      brandHexes: fromIntake.brandHexes,
    };
  }, [project, saved]);

  const [info, setInfo] = useState(start.businessInfo);
  // This project's replica templates (customFor) come first, labeled; no
  // other project ever sees them.
  const ranked = useMemo(() => rankTemplates(ALL_TEMPLATES, info.businessType, form.styles || [], project.id), [info.businessType, form.styles, project.id]);
  const replicas = useMemo(() => replicaTemplatesFor(ALL_TEMPLATES, project.id), [project.id]);
  const [templateId, setTemplateId] = useState(start.templateId || '');
  const [useBrand, setUseBrand] = useState(saved ? saved.useBrand !== false && start.brandHexes.length > 0 : start.brandHexes.length > 0);
  const [slots, setSlots] = useState(start.slots);
  // The Design Studio's settings (src/lib/designLevers.js).
  const [levers, setLevers] = useState(() => sanitizeLevers(start.levers, start.templateId || ''));
  // Reference sites: inspire / match one / exact replica (design.reference).
  const [reference, setReference] = useState(() => sanitizeReference(saved?.reference, { projectId: project.id }));
  // The project's files with signed links, and project.assets (what the
  // match check reads, as the server does); both refreshed after the team
  // adds a reference screenshot, so it shows (and can be matched) at once.
  const [projectFiles, setProjectFiles] = useState(project.files || []);
  useEffect(() => { setProjectFiles(project.files || []); }, [project.files]);
  const [projectAssets, setProjectAssets] = useState(project.assets || []);
  useEffect(() => { setProjectAssets(project.assets || []); }, [project.assets]);
  // Only the latest refresh lands: screenshots are added one after another,
  // and an older list arriving last would hide the newer ones.
  const filesRefresh = useRef(0);
  // Screenshot picks still uploading in Reference sites: a tall one goes up
  // in parts, and a match started after the first would see only the top,
  // so Suggest a design holds a match until they are all in.
  const [shotUploads, setShotUploads] = useState(0);
  const onShotBusy = (on) => setShotUploads((n) => Math.max(0, n + (on ? 1 : -1)));
  // designSuggest.js decides which screenshots picture a matched address
  // (the rule the run uses). Loaded on demand, like the Studio's panels,
  // so it stays out of the bundle every visitor downloads.
  const [urlShots, setUrlShots] = useState(null);
  // The same module's rule for the outline our server read from a
  // reference's code (referenceOutlineOf), for the "From its code" block.
  const [outlineRule, setOutlineRule] = useState(null);
  useEffect(() => {
    let live = true;
    import('../../lib/designSuggest.js')
      .then((m) => {
        if (!live) return;
        setUrlShots(() => m.referenceShots);
        setOutlineRule(() => m.referenceOutlineOf);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Sites the team added by address (design.referenceSites), saved with the
  // page as soon as one is added or removed.
  const [teamSites, setTeamSites] = useState(() => sanitizeReferenceSites(project.design?.referenceSites));
  // The server's last screenshot run of an address (design.capture): the
  // newest record of the page's project, the polls and the answers to a
  // start. Every poll tick also moves the clock (captureTick), answered or
  // not, so a run that never finishes turns stale and the polls stop.
  const [captureSeen, setCaptureSeen] = useState(null);
  const [, setCaptureTick] = useState(0);
  // The address key of a start waiting for its answer, and why the last
  // start of each address failed ({ key: message }).
  const [captureStarting, setCaptureStarting] = useState('');
  const [captureErrors, setCaptureErrors] = useState({});
  const capture = newerCapture(project.design?.capture, captureSeen);
  const nowMs = Date.now();
  const captureLive = isCaptureLive(capture, nowMs);
  // "Copy this site's layout" (Reference sites): one click per reference
  // does in order what the admin would do by hand: screenshots of an
  // address that needs them (captured, then waited for with the polls
  // below), the match saved, then Suggest a design's own start. One copy
  // at a time; a step that fails stops it and says why. Nothing is
  // applied: the admin still ticks the parts and presses Apply.
  //   { key (the list item), token, step: 'capture' | 'save' | 'start' |
  //     'matching' | 'ready' | 'failed', error, at (the step that failed) }
  const [copyRun, setCopyRun] = useState(null);
  // Bumped to run SuggestPanel's own start once (0: nothing to start).
  const [suggestToken, setSuggestToken] = useState(0);
  const copySeq = useRef(0);
  // A copy waiting for a capture to end: { key, since, resolve }.
  const captureWait = useRef(null);
  // The page as last rendered, for a copy's steps after a wait: the admin
  // keeps working while a capture runs, and the save must send the page
  // as it is then, not as it was at the click.
  const pageNow = useRef(null);
  const copyLocked = !!copyRun && ['capture', 'save', 'start'].includes(copyRun.step);

  // Default to the best match once the business type is known (the one
  // labeled so: a replica leads the list but is picked on purpose).
  useEffect(() => {
    if (!templateId && ranked.length && info.businessType) setTemplateId((ranked.find((r) => !r.replica) || ranked[0]).id);
  }, [templateId, ranked, info.businessType]);

  // A section order belongs to one template: a switch starts the new one
  // from its own default order (keeping the rest of the settings).
  const leversTemplate = useRef(start.templateId || '');
  useEffect(() => {
    if (leversTemplate.current === templateId) return;
    const from = leversTemplate.current;
    leversTemplate.current = templateId;
    setLevers((l) => sanitizeLevers(from ? { ...l, sections: { order: [], hidden: [] } } : l, templateId));
  }, [templateId]);

  // The site's own text and settings once it has been written, so the
  // preview shows the real page rather than sample text.
  const [site, setSite] = useState(null);
  useEffect(() => {
    const id = saved?.siteId || project.site_id;
    if (!id) return undefined;
    let live = true;
    supabase.from('sites').select('business_info, generated_content').eq('id', id).maybeSingle()
      .then(({ data }) => { if (live && data) setSite({ info: data.business_info || {}, ...unpackGeneratedContent(data.generated_content) }); })
      .catch(() => {});
    return () => { live = false; };
  }, [saved?.siteId, project.site_id]);

  // Half-typed About stat rows survive applying a look, brand or suggestion
  // (those sanitize the levers, which drops incomplete rows).
  const keepStats = (next) => setLevers((l) => ({ ...next, aboutStats: l.aboutStats }));

  const template = templateById(templateId);
  const accent = template && useBrand ? brandAccent(template.colors?.bg, start.brandHexes) : {};
  const files = projectFiles.filter((f) => f.url);
  const importable = files.filter((f) => isImportable(f.name));
  const notImportable = files.filter((f) => !isImportable(f.name) && f.kind !== 'reference');
  const set = (k) => (e) => setInfo((prev) => ({ ...prev, [k]: e.target.value }));

  function setService(i, patch) {
    setInfo((prev) => ({ ...prev, services: prev.services.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  }

  // Changed since the last write? Sticky until a run applies them (the
  // background run clears it), so Save now and Rewrite later still applies.
  const cleanLevers = sanitizeLevers(levers, templateId);
  const leversChanged = [...new Set([
    ...leverGroupsChanged(saved?.leversChanged),
    ...changedLeverGroups(cleanLevers, sanitizeLevers(saved?.levers, templateId)),
  ])];

  const cleanReference = useMemo(
    () => withBuiltReplica(sanitizeReference(reference, { projectId: project.id }), replicas, templateId),
    [reference, replicas, templateId, project.id],
  );
  // SuggestPanel shows thumbnails from project.files and checks a match
  // against project.assets: give it the fresh lists.
  const suggestProject = useMemo(
    () => ({ ...project, files: projectFiles, assets: projectAssets }),
    [project, projectFiles, projectAssets],
  );

  // The design as it will be saved, with images (once imported) and colors.
  function buildDesign(extra = {}) {
    return {
      levers: cleanLevers,
      leversChanged,
      businessInfo: info,
      templateId,
      template: { label: template?.label || '', mood: template?.mood || '' },
      customColors: accent,
      useBrand,
      slots,
      images: saved?.images || {},
      imported: saved?.imported || {},
      siteId: saved?.siteId || project.site_id || '',
      reference: cleanReference,
      referenceSites: teamSites,
      ...extra,
    };
  }

  const forgetCaptureError = (key) => setCaptureErrors((m) => {
    if (!key || !(key in m)) return m;
    const next = { ...m };
    delete next[key];
    return next;
  });
  // A record of the capture (a start's answer, a refusal, a poll): the
  // newest one shows, and it moves the page's clock. A run of an address
  // seen going replaces why its last start failed (it was started since,
  // here or in another tab).
  const seeCapture = (run) => {
    setCaptureSeen((prev) => newerCapture(prev, run));
    setCaptureTick((n) => n + 1);
    if (isCaptureLive(run)) forgetCaptureError(referenceSiteKey(run.url));
    settleCaptureWait(run);
  };

  // Ends a copy's wait once the capture it waits for has ended: ready,
  // failed, or past its live window by this page's clock (stale; the polls
  // stop then). Only a run of that address that started no earlier than
  // the one it waits for. The page takes the poll's files before the copy
  // goes on (the copy resumes after this handler returns).
  function settleCaptureWait(run, now = Date.now()) {
    const w = captureWait.current;
    if (!w || !run || referenceSiteKey(run.url) !== w.key || isCaptureLive(run, now)) return;
    if ((Date.parse(run.startedAt || '') || 0) < w.since) return;
    captureWait.current = null;
    w.resolve(run);
  }

  // Screenshots of `url` taken on our server (adding a site, or Capture
  // again). A start that fails says why on that site; one refused because
  // a capture is already going watches that one instead.
  // Returns { ok, run } (the run to watch: this one, or this same site's
  // capture already going) or { ok: false, error }.
  async function startCapture(url, note = '') {
    const key = referenceSiteKey(url);
    if (!key) return { ok: false, error: 'That isn\'t a web address.' };
    setCaptureStarting(key);
    forgetCaptureError(key);
    try {
      const res = await captureReference(project.id, url, note);
      const run = res?.capture || res?.project?.design?.capture;
      if (run) seeCapture(run);
      return { ok: true, run: run || null };
    } catch (e) {
      // Only a live run is one to watch: a 409 for any other reason (the
      // project kept changing while claiming) says its own message.
      const going = e?.status === 409 && isCaptureLive(e.data?.capture) ? e.data.capture : null;
      if (going) seeCapture(going);
      // Refused because this same site is being captured: nothing to add.
      if (going && referenceSiteKey(going.url) === key) return { ok: true, run: going };
      // Worded to stay true once that other capture is done: the message
      // stays until this site is captured.
      const why = going ? 'Another site was being captured. Capture this one once that\'s done.' : e?.message || 'Could not start the capture.';
      setCaptureErrors((m) => ({ ...m, [key]: why }));
      return { ok: false, error: why };
    } finally {
      setCaptureStarting('');
    }
  }

  // The fresh project.assets (after a capture, or a screenshot the team
  // added). A capture of an address again replaces its earlier parts: a
  // reference picked from one of them follows to the new part in its
  // place, as the capture moved the saved one, so a later Save can't put
  // back a file that's gone. `before` is the list as this page has it.
  function takeAssets(fresh, before = projectAssets) {
    setReference((r) => {
      const moved = replacedShotSource(r?.source, before, fresh);
      return moved ? { ...r, source: moved } : r;
    });
    setProjectAssets(fresh);
  }

  // While a capture is live: `get` every few seconds (CaptureWatch). Only
  // the run is taken from an answer while it goes (every answer signs the
  // file links again, and new links would reload every thumbnail); once it
  // has ended, the files too, so its screenshots show (and can be matched)
  // at once. A screenshot refresh started after this poll is newer and
  // wins (filesRefresh, as in onShotAdded); this one in turn drops older
  // refreshes still out.
  async function pollCapture() {
    const seq = filesRefresh.current;
    const res = await customSiteAdmin('get', { id: project.id });
    return { project: res?.project || null, seq };
  }
  function onCapturePolled({ project: fresh, seq } = {}) {
    const run = fresh?.design?.capture;
    if (!run) return;
    seeCapture(run);
    if (isCaptureLive(run) || seq !== filesRefresh.current) return;
    filesRefresh.current += 1;
    if (Array.isArray(fresh.files)) setProjectFiles(fresh.files);
    if (Array.isArray(fresh.assets)) takeAssets(fresh.assets);
  }

  // A site the team adds by its address: saved with the page at once (like
  // a replica request), then captured. Returns { error } for the add box
  // (a bad or listed address), { ok: false } when the save failed (said at
  // the bottom like any save) or { ok: true }.
  async function addSite(rawUrl, rawNote) {
    const url = referenceSiteUrl(rawUrl);
    if (!url) {
      // The box takes 500 characters, and "https://" may be added to them.
      const tooLong = !!safeHref(String(rawUrl || '').trim());
      return { error: tooLong ? `That address is too long (${REFERENCE_SITE_URL_MAX} characters at most).` : 'Enter a web address, like shopname.com.' };
    }
    const key = referenceSiteKey(url);
    const listed = [...(Array.isArray(form.referenceSites) ? form.referenceSites : []).map((r) => r?.url), ...teamSites.map((s) => s.url)];
    if (listed.some((u) => referenceSiteKey(u) === key)) return { error: 'That site is already in the list.' };
    if (teamSites.length >= REFERENCE_SITES_MAX) return { error: `The team can add up to ${REFERENCE_SITES_MAX} sites.` };
    const site = sanitizeReferenceSites([{ url, note: rawNote, addedAt: new Date().toISOString() }])[0];
    const next = [...teamSites, site];
    setBusy('save');
    setError('');
    try {
      await customSiteAdmin('design-save', { id: project.id, design: buildDesign({ referenceSites: next }) });
    } catch (e) {
      setError(e.message || 'Could not save');
      return { ok: false };
    } finally {
      setBusy('');
    }
    setTeamSites(next);
    await startCapture(site.url, site.note);
    return { ok: true };
  }

  // Takes a site the team added off the list (saved at once). Its
  // screenshots stay in the project's files until someone deletes them.
  async function removeSite(url) {
    const key = referenceSiteKey(url);
    const next = teamSites.filter((s) => referenceSiteKey(s.url) !== key);
    setBusy('save');
    setError('');
    try {
      await customSiteAdmin('design-save', { id: project.id, design: buildDesign({ referenceSites: next }) });
      setTeamSites(next);
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setBusy('');
    }
  }

  // A capture of the matched address is still going: its parts aren't all
  // in yet (and a new capture replaces the old parts), so Suggest a design
  // holds a match as it does while screenshots upload. The same for a
  // match on one of the parts an earlier capture of that address took:
  // they are about to be replaced.
  const capturingKey = captureLive ? referenceSiteKey(capture.url) : '';
  const matchSource = cleanReference.mode === 'match' ? cleanReference.source : null;
  const matchCapturing = !!capturingKey && !!matchSource && (matchSource.kind === 'url'
    ? referenceSiteKey(matchSource.url) === capturingKey
    : capturedShotKey(projectAssets.find((a) => a?.path === matchSource.path)) === capturingKey);

  // A replica request (or its cancel) saves the page at once, so the
  // request is on the project when someone asks Claude to build it.
  // The page shows the request only once it is saved: a failed save must
  // not look like a request someone could act on. Returns whether it saved
  // (a copy goes on only then); no toast without a message.
  async function saveReference(next, message) {
    setBusy('save');
    setError('');
    try {
      const ref = withBuiltReplica(sanitizeReference(next, { projectId: project.id }), replicas, templateId);
      await customSiteAdmin('design-save', { id: project.id, design: buildDesign({ reference: ref }) });
      setReference(next);
      if (message) toast(message, 'success');
      return true;
    } catch (e) {
      setError(e.message || 'Could not save');
      return false;
    } finally {
      setBusy('');
    }
  }

  // "Copy this site's layout" on one reference (ReferenceSection's item).
  // An address first gets its screenshots (copyCapturePlan: taken now,
  // waited for, or the ones it has); then the match is saved as the "Match
  // its layout" choice would be, and Suggest a design starts exactly as its
  // own button does (SuggestPanel startToken), which keeps the run, its
  // polls and the review. The 409s (another capture going, a suggestion
  // already running) stop it with their message.
  async function copyLayout(item) {
    if (!item?.source || copyLocked) return;
    copySeq.current += 1;
    const token = copySeq.current;
    const move = (patch) => setCopyRun((c) => (c?.token === token ? { ...c, ...patch } : c));
    const view = item.kind === 'url' ? captureViewFor(capture, item.href, Date.now()) : null;
    const failedStart = view && view.state !== 'running' ? captureErrors[item.siteKey] || '' : '';
    const plan = view ? copyCapturePlan({ view, failedStart, assets: projectAssets, key: item.siteKey }) : 'match';
    setCopyRun({ key: item.key, token, step: plan === 'match' ? 'save' : 'capture', error: '', at: '' });
    if (plan !== 'match') {
      const shots = await copyScreenshots(item, plan);
      if (!shots.ok) {
        move({ step: 'failed', error: shots.error, at: 'capture' });
        return;
      }
      move({ step: 'save' });
    }
    // The page as it is now (a capture takes a while), with this reference matched.
    const page = pageNow.current;
    const saved = await page.saveReference({ ...page.reference, mode: 'match', source: item.source }, '');
    if (!saved) {
      move({ step: 'failed', error: 'the page didn\'t save, so nothing was started.', at: 'save' });
      return;
    }
    move({ step: 'start' });
    setSuggestToken(token);
    if (typeof document !== 'undefined') document.getElementById(SUGGEST_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // An address's screenshots for a copy: started now ('capture') or
  // already going ('wait'), then waited for until the run ends (the page's
  // polls see it: settleCaptureWait). { ok } once they are in, else { ok:
  // false, error } (the capture block under the site says why too, with
  // "Upload a screenshot instead").
  async function copyScreenshots(item, plan) {
    let since = Date.parse(capture?.startedAt || '') || 0;
    if (plan === 'capture') {
      const started = await startCapture(item.href, item.captureNote);
      if (!started.ok) return { ok: false, error: started.error };
      if (!started.run) return { ok: false, error: 'The capture didn\'t start. Try again.' };
      since = Date.parse(started.run.startedAt || '') || 0;
    }
    const run = await new Promise((resolve) => { captureWait.current = { key: item.siteKey, since, resolve }; });
    if (run.status === 'ready') return { ok: true };
    return { ok: false, error: run.status === 'failed' ? run.error || 'The capture failed.' : 'The capture didn\'t finish (it may have timed out).' };
  }

  // How Suggest a design's start for a copy went, and then how its run
  // ended (SuggestPanel onAutoRun). Only the copy that sent the token
  // moves; once the start has answered, the token is spent (0), so a
  // remounted panel never starts it again.
  function onAutoRun({ token, status, error: why = '' } = {}) {
    if (status === 'refused' || status === 'running') setSuggestToken((t) => (t === token ? 0 : t));
    setCopyRun((c) => {
      if (!c || c.token !== token) return c;
      if (status === 'refused') return { ...c, step: 'failed', error: why || 'Suggest a design didn\'t start.', at: 'start' };
      if (status === 'ready') return { ...c, step: 'ready', error: '', at: '' };
      if (status === 'failed') return { ...c, step: 'failed', error: why, at: 'matching' };
      return { ...c, step: 'matching' };
    });
  }

  // A screenshot the team just added (ReferenceShotUpload, here or in
  // SuggestPanel): `asset` comes with its signed link and `row` is the
  // project row with the new assets, so it shows and can be matched at
  // once; then the files are fetched again. A matched address stays the
  // source: its screenshots are found by their "Screenshot of <url>" note.
  async function onShotAdded(asset, row) {
    if (asset?.path) {
      setProjectFiles((list) => (list.some((f) => f.path === asset.path) ? list : [...list, asset]));
      if (Array.isArray(row?.assets)) takeAssets(row.assets);
      else {
        const stored = { ...asset };
        delete stored.url;
        delete stored.downloadUrl;
        setProjectAssets((list) => (list.some((a) => a.path === asset.path) ? list : [...list, stored]));
      }
    }
    const seq = ++filesRefresh.current;
    try {
      const res = await customSiteAdmin('get', { id: project.id });
      if (seq !== filesRefresh.current) return;
      if (Array.isArray(res.project?.files)) setProjectFiles(res.project.files);
      if (Array.isArray(res.project?.assets)) takeAssets(res.project.assets);
    } catch (e) {
      if (seq === filesRefresh.current) toast(`Added, but the list didn't refresh (${e.message || 'reload the page'})`, 'error');
    }
  }

  async function save() {
    setBusy('save');
    setError('');
    try {
      await customSiteAdmin('design-save', { id: project.id, design: buildDesign() });
      toast('Design saved', 'success');
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setBusy('');
    }
  }

  // Copies the chosen uploads into the site's images (only ones that
  // changed since the last run), then saves and starts the writing.
  async function generate() {
    setError('');
    const draft = buildDesign();
    const missing = designProblems({ ...draft, siteId: 'pending' });
    if (missing.length) { setError(`Fill in: ${missing.join(', ')}`); return; }
    if (project.site_id) {
      const ok = await confirm(
        'This rewrites the site\'s text and business details from this page, replacing text changed in the editor. Photos, the brand color and the Design Studio settings change only where you changed them here; the rest of your editor work stays.',
        { title: 'Rewrite the site?', confirmText: 'Rewrite' },
      );
      if (!ok) return;
    }
    setBusy('generate');
    try {
      const siteId = draft.siteId || crypto.randomUUID();
      const wanted = { logo: slots.logo, hero: slots.hero, about: slots.about };
      slots.gallery.forEach((p, i) => { wanted[`gallery${i}`] = p; });
      // Photo links expire an hour after the page loaded: get fresh ones.
      const fresh = (await customSiteAdmin('get', { id: project.id })).project?.files || [];
      const images = {};
      const imported = {};
      for (const [key, path] of Object.entries(wanted)) {
        if (!path) continue;
        if (draft.imported[key] === path && draft.images[key]) {
          images[key] = draft.images[key];
          imported[key] = path;
          continue;
        }
        const file = fresh.find((f) => f.path === path && f.url);
        if (!file) continue;
        setBusy(`Copying ${file.name}…`);
        images[key] = await importAssetToSite({ url: file.url, name: file.name, siteId, imageKey: key });
        imported[key] = path;
      }
      // What this session changed: a rewrite applies only these to the site.
      const keys = new Set([...Object.keys(wanted), ...Object.keys(draft.imported)]);
      const imagesChanged = [...keys].filter((k) => (wanted[k] || '') !== (draft.imported[k] || ''));
      const colorsChanged = (saved?.customColors?.accent || '') !== (accent.accent || '') || (saved?.templateId || '') !== templateId;
      setBusy('Starting…');
      await customSiteAdmin('design-save', { id: project.id, design: { ...draft, siteId, images, imported, imagesChanged, colorsChanged } });
      await generateDesign(project.id);
      onStarted?.();
    } catch (e) {
      setError(e.message || 'Could not start');
      setBusy('');
    }
  }

  pageNow.current = { reference: cleanReference, saveReference };

  const toggleGallery = (path) => setSlots((prev) => {
    const has = prev.gallery.includes(path);
    return { ...prev, gallery: has ? prev.gallery.filter((p) => p !== path) : [...prev.gallery, path].slice(0, 12) };
  });

  return (
    <div>
      {/* Outside the Suspense below: a Studio panel still loading must not
          hold the polls back. */}
      {captureLive && (
        <CaptureWatch
          load={pollCapture}
          onResult={onCapturePolled}
          onTick={() => { setCaptureTick((n) => n + 1); settleCaptureWait(capture); }}
        />
      )}
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        Back to the project
      </button>
      <header className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#cc0000]">Design · {project.business_name || project.client_name}</p>
        <h2 className="mt-1 text-[28px] sm:text-[34px] leading-[1.1] font-[900] tracking-tight text-[#1a1a1a]">Set up the site</h2>
        <p className="mt-1.5 text-[14px] text-[#4a4a4a] max-w-2xl">
          Everything here starts from {project.client_first_name || 'the customer'}'s answers. Check it, pick the look and photos,
          and {MODEL_NAME} writes the site from these details plus their whole brief. You'll polish it in the editor after.
        </p>
      </header>

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)] lg:gap-6 lg:items-start">
      <div className="space-y-6 min-w-0">
        <Section title="Business details" intro="What the site says about the business. Facts only: the AI won't invent anything you leave out.">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Business name"><input value={info.businessName} onChange={set('businessName')} className={INPUT} /></Field>
            <Field label="Business type" hint={!form.businessType || form.businessType === 'other' ? `They answered "${form.businessType ? 'Something else' : 'nothing'}": pick the closest.` : null}>
              <select value={info.businessType} onChange={set('businessType')} className={INPUT}>
                <option value="">Choose one</option>
                {SITE_BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="City" hint="Used in headings and search results."><input value={info.city} onChange={set('city')} className={INPUT} /></Field>
            <Field label="State" hint="Two letters, like FL."><input value={info.state} onChange={set('state')} maxLength={20} className={INPUT} /></Field>
            <Field label="Phone"><input value={info.phone} onChange={set('phone')} className={INPUT} /></Field>
            <Field label="Address" hint="Leave blank for mobile-only businesses."><input value={info.address} onChange={set('address')} className={INPUT} /></Field>
            <Field label="Service area"><input value={info.serviceArea} onChange={set('serviceArea')} className={INPUT} /></Field>
            <Field label="Hours" hint="As they wrote them."><input value={info.hours} onChange={set('hours')} className={INPUT} /></Field>
            <Field label="Why customers choose them" className="sm:col-span-2">
              <textarea rows={3} value={info.specialties} onChange={set('specialties')} className={`${INPUT} leading-relaxed`} />
            </Field>
          </div>
          <div className="mt-5">
            <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">Services</p>
            {!showsPrices(info.businessType) && (
              <p className="-mt-1 mb-2 text-[11px] text-ink-tertiary">This business type's templates list services without prices.</p>
            )}
            <div className="space-y-2">
              {info.services.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input value={s.name} onChange={(e) => setService(i, { name: e.target.value })} placeholder="Service" aria-label={`Service ${i + 1} name`} className={INPUT} />
                  {showsPrices(info.businessType) && (
                    <input value={s.price} onChange={(e) => setService(i, { price: e.target.value })} placeholder="Price" aria-label={`Service ${i + 1} price`} className={`${INPUT} max-w-[140px]`} />
                  )}
                  <button
                    type="button"
                    onClick={() => setInfo((prev) => ({ ...prev, services: prev.services.filter((_, j) => j !== i) }))}
                    aria-label={`Remove service ${i + 1}`}
                    className="w-9 shrink-0 rounded-lg text-ink-tertiary hover:text-[#cc0000] hover:bg-black/[0.04]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInfo((prev) => ({ ...prev, services: [...prev.services, { name: '', price: '', description: '' }] }))}
              className="mt-2 text-[13px] font-semibold text-[#cc0000] hover:text-[#a80000]"
            >
              + Add a service
            </button>
          </div>
        </Section>

        <Section title="Look" intro={form.styles?.length ? `They picked: ${form.styles.join(', ')}.` : 'They didn\'t pick a style.'}>
          {!info.businessType ? (
            <p className="text-[13px] text-ink-tertiary">Choose the business type first.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ranked.map((r) => {
                const t = templateById(r.id);
                const on = templateId === r.id;
                // Replicas lead the list; "Best match" stays on the best of the rest.
                const best = !r.replica && r.id === ranked.find((x) => !x.replica)?.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setTemplateId(r.id)}
                      aria-pressed={on}
                      className={`w-full h-full text-left rounded-xl border p-3.5 transition-colors ${on ? 'border-[#cc0000] bg-[#cc0000]/[0.05]' : 'border-black/[0.08] hover:border-[#cc0000]/40'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex overflow-hidden rounded-md border border-black/10" aria-hidden="true">
                          {[t.colors?.bg, t.colors?.accent, t.colors?.secondary].map((c, k) => <span key={k} className="w-5 h-7" style={{ background: c }} />)}
                        </span>
                        <span className="text-[14px] font-bold text-[#1a1a1a]">{t.label}</span>
                        {best && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#cc0000]">Best match</span>}
                      </span>
                      <span className="block mt-1.5 text-[12px] text-ink-tertiary leading-snug">{t.description}</span>
                      {r.reasons.length > 0 && (
                        <span className={`block mt-1 text-[11px] ${r.replica ? 'font-bold text-[#cc0000]' : 'text-[#4a4a4a]'}`}>{r.reasons.join(' · ')}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {start.brandHexes.length > 0 ? (
              <>
                <label className="inline-flex items-center gap-2 text-[13px] text-[#1a1a1a] cursor-pointer">
                  <input type="checkbox" checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} className="w-4 h-4 accent-[#cc0000]" />
                  Use their brand color for buttons and highlights
                </label>
                <span className="flex gap-1.5" aria-label="Their colors">
                  {start.brandHexes.map((h) => <span key={h} title={h} className="w-5 h-5 rounded border border-black/15" style={{ background: h }} />)}
                </span>
                {useBrand && template && (
                  accent.accent
                    ? <span className="text-[12px] text-ink-tertiary">Accent on {template.label}: <span className="inline-block w-3 h-3 rounded-sm align-middle border border-black/15" style={{ background: accent.accent }} /> {accent.accent}</span>
                    : <span className="text-[12px] text-amber-800">None of their colors works as a highlight on this template's background; it keeps its own.</span>
                )}
              </>
            ) : (
              <p className="text-[13px] text-ink-tertiary">
                {form.colorMode === 'logo' ? 'They asked to match their logo: set the colors in the editor after.' : 'No brand colors given: the template keeps its own. You can change colors in the editor.'}
              </p>
            )}
          </div>
        </Section>

        <Suspense fallback={<Loading />}>
        <ReferenceSection
          project={project}
          files={projectFiles}
          reference={cleanReference}
          urlShots={urlShots ? (source) => urlShots(source, projectAssets) : null}
          replicas={replicas}
          templateId={templateId}
          busy={busy}
          onChange={setReference}
          onSave={saveReference}
          onShotAdded={onShotAdded}
          onShotBusy={onShotBusy}
          onPickTemplate={setTemplateId}
          teamSites={teamSites}
          capture={capture}
          nowMs={nowMs}
          captureStarting={captureStarting}
          captureErrors={captureErrors}
          onAddSite={addSite}
          onRemoveSite={removeSite}
          onCapture={startCapture}
          // The outline sits on the stored asset: the admin's answer keeps
          // it in project.assets and in the signed files list alike.
          outlineOf={outlineRule ? (source) => outlineRule(source, projectAssets) || outlineRule(source, projectFiles) : null}
          copyRun={copyRun}
          copyLocked={copyLocked}
          onCopy={copyLayout}
          uploading={shotUploads > 0}
        />

        <Section id={SUGGEST_SECTION_ID} title="Suggest a design" intro={`Let ${MODEL_NAME} propose the whole look from their files and answers. You review every part.`}>
          <SuggestPanel
            project={suggestProject}
            reference={cleanReference}
            onReferenceAdded={onShotAdded}
            // A match takes their brand color only when this page does,
            // saved or not.
            useBrand={useBrand}
            uploading={shotUploads > 0 || matchCapturing}
            current={{ templateId, levers: cleanLevers, slots }}
            modelName={MODEL_NAME}
            // A copy's steps change the reference it would send.
            disabled={!!busy || copyLocked}
            // "Copy this site's layout": its own start, once per token.
            startToken={suggestToken}
            onAutoRun={onAutoRun}
            onApply={(next) => {
              // The suggestion's sections are made for its template: move the
              // levers' template marker first so the switch keeps them.
              if (next.templateId !== templateId) {
                leversTemplate.current = next.templateId;
                setTemplateId(next.templateId);
              }
              keepStats(next.levers);
              setSlots(next.slots);
            }}
          />
        </Section>

        <BrandSystemCard
          projectId={project.id}
          brand={project.design?.brand || null}
          levers={cleanLevers}
          onApply={(next) => keepStats(sanitizeLevers(next, templateId))}
        />

        {template && (
          <>
            <Section title="Starting look" intro="Curated looks for this template. Pick one, then fine-tune below.">
              <LooksPicker templateId={templateId} levers={cleanLevers} disabled={!!busy} onApply={keepStats} />
            </Section>

            <Section title="Colors" intro="All five colors of the page. The site repairs any pair that isn't readable.">
              <PaletteField
                value={levers.palette}
                onChange={(palette) => setLevers((l) => ({ ...l, palette }))}
                templateId={templateId}
                defaults={template.colors}
                brandHexes={start.brandHexes}
              />
            </Section>

            <Section title="Fonts" intro="A heading and body pair. Custom sites can use every font in the catalog.">
              <FontField
                value={levers.fonts}
                onChange={(fonts) => setLevers((l) => ({ ...l, fonts }))}
                defaults={{ heading: template.font, body: template.bodyFont }}
                styles={form.styles}
                businessType={info.businessType}
                mood={template.mood}
                sample={info.businessName}
              />
            </Section>

            <Section title="Sections" intro="Order and show or hide the page's sections.">
              <SectionsField templateId={templateId} value={levers.sections} onChange={(sections) => setLevers((l) => ({ ...l, sections }))} />
            </Section>

            <Section title="Layout" intro="The hero and About layouts.">
              <LayoutField templateId={templateId} value={levers} onChange={(part) => setLevers((l) => ({ ...l, ...part }))} />
            </Section>

            <Section title="Trust facts" intro="Only what they told you. Empty fields stay off the site.">
              <FactsField value={levers.facts} onChange={(facts) => setLevers((l) => ({ ...l, facts }))} />
            </Section>

            <Section title="Google profile" intro="Their real Google rating, for templates with a Google badge.">
              <GooglePlaceField
                value={levers.googlePlace}
                onChange={(googlePlace) => setLevers((l) => ({ ...l, googlePlace }))}
                businessName={info.businessName}
                city={info.city}
                state={info.state}
                profileLink={form.googleProfile}
                disabled={!!busy}
              />
            </Section>
          </>
        )}

        </Suspense>

        <Section title="Photos" intro="Copied into the site when it's written (resized for the web). You can change them in the editor later.">
          {importable.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">No usable photos yet. The template's placeholders show until you add some in the editor.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(SLOT_LABELS).map(([slot, label]) => (
                <div key={slot}>
                  <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSlots((p) => ({ ...p, [slot]: '' }))} aria-pressed={!slots[slot]}
                      className={`w-20 h-20 rounded-lg border text-[11px] font-semibold ${!slots[slot] ? 'border-[#cc0000] text-[#cc0000]' : 'border-black/[0.10] text-ink-tertiary'}`}>
                      None
                    </button>
                    {importable.filter((f) => (slot === 'logo' ? f.kind === 'logo' || f.kind === 'brand' : f.kind === 'photo')).map((f) => (
                      <button key={f.path} type="button" onClick={() => setSlots((p) => ({ ...p, [slot]: f.path }))} aria-pressed={slots[slot] === f.path} title={f.name}
                        className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${slots[slot] === f.path ? 'border-[#cc0000]' : 'border-transparent'}`}
                        style={{ background: 'repeating-conic-gradient(#f1f1f1 0% 25%, #fff 0% 50%) 50% / 12px 12px' }}>
                        <img src={f.url} alt={f.name} className={`w-full h-full ${slot === 'logo' ? 'object-contain p-1' : 'object-cover'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">Gallery <span className="font-normal text-ink-tertiary">({slots.gallery.length} of 12)</span></p>
                <div className="flex flex-wrap gap-2">
                  {importable.filter((f) => f.kind === 'photo').map((f) => {
                    const on = slots.gallery.includes(f.path);
                    return (
                      <button key={f.path} type="button" onClick={() => toggleGallery(f.path)} aria-pressed={on} title={f.name}
                        className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 ${on ? 'border-[#cc0000]' : 'border-transparent'}`}>
                        <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                        {on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#cc0000] text-white text-[11px] font-bold flex items-center justify-center">{slots.gallery.indexOf(f.path) + 1}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {notImportable.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
              Can't be used as-is (convert to JPG or PNG first): {notImportable.map((f) => `${f.name}${f.size ? ` (${formatBytes(f.size)})` : ''}`).join(', ')}.
            </p>
          )}
        </Section>
      </div>

      {template && (
        <aside className="mt-6 lg:mt-0 lg:sticky lg:top-4" aria-label="Preview">
          <Suspense fallback={<Loading />}>
            <DesignPreview
              templateId={templateId}
              businessInfo={info}
              levers={cleanLevers}
              copy={site?.copy}
              existingInfo={site?.info}
              customColors={{ ...(site?.customColors || {}), ...accent }}
              customFonts={site?.customFonts}
              images={{ ...(site?.images || {}), ...slotImages({ slots, files: projectFiles, images: saved?.images, imported: saved?.imported }) }}
              projectId={project.id}
            />
          </Suspense>
        </aside>
      )}
      </div>

      <div className="sticky bottom-0 z-20 mt-6 -mx-3 px-3 py-4 bg-[#faf9f7]/95 backdrop-blur border-t border-black/[0.07] flex flex-wrap items-center gap-3">
        {error && <p role="alert" className="text-[13px] font-medium text-[#cc0000]">{error}</p>}
        {busy && busy !== 'save' && busy !== 'generate' && <p role="status" className="text-[13px] text-ink-tertiary">{busy}</p>}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={save} disabled={!!busy} className={BTN}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={generate} disabled={!!busy} className={BTN_PRIMARY}>
            {busy && busy !== 'save' ? 'Working…' : project.site_id ? `Rewrite with ${MODEL_NAME}` : `Write the site with ${MODEL_NAME}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hand-over ───────────────────────────────────────────────────────

export function HandoverCard({ project, onDone }) {
  const { toast, confirm } = useAlert();
  const [account, setAccount] = useState(undefined); // undefined = loading, null = none
  const [compPro, setCompPro] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState('');
  const site = project.site || null;
  const first = project.client_first_name || 'the customer';
  const handedOver = !!project.handed_over_at;

  useEffect(() => {
    if (handedOver || !site) return undefined;
    let live = true;
    customSiteAdmin('handover-check', { id: project.id })
      .then((res) => { if (live) setAccount(res.account || null); })
      .catch(() => { if (live) setAccount(null); });
    return () => { live = false; };
  }, [project.id, handedOver, site]);

  async function handOver() {
    const lines = [
      account ? `Move the site to ${account.email}'s account.` : `Create an account for ${project.client_email} and move the site there.`,
      compPro && !account?.isPro ? 'Give them Pro (bookings and payments) at no charge.' : null,
      !compPro && !account?.isPro ? 'They stay on the free plan: bookings switch off, and the free-plan badge appears once the site is republished.' : null,
      sendEmail ? (account ? 'Email them that the site is in their account.' : 'Email them a link to set their password.') : 'Send no email.',
      'After this, publishing happens from their account.',
    ].filter(Boolean);
    const ok = await confirm(lines.join(' '), { title: 'Hand the site over?', confirmText: 'Hand over' });
    if (!ok) return;
    setBusy('handover');
    try {
      // Never comp Pro on top of a plan they pay for.
      const res = await customSiteAdmin('handover', { id: project.id, compPro: compPro && !account?.isPro, sendEmail });
      if (res.emailError) toast(`Handed over, but the email didn't send: ${res.emailError}`, 'error');
      else toast(`The site is in ${project.client_email}'s account now`, 'success');
      onDone?.();
    } catch (e) {
      toast(e.message || 'Could not hand over', 'error');
    } finally {
      setBusy('');
    }
  }

  async function resend() {
    setBusy('email');
    try {
      await customSiteAdmin('handover-email', { id: project.id });
      toast(`Access email sent to ${project.client_email}`, 'success');
      onDone?.();
    } catch (e) {
      toast(e.message || 'The email did not send', 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px] mb-3">Hand-over</h3>
      {handedOver ? (
        <div className="text-[13px]">
          <p className="text-[#1a1a1a]">In <strong>{site?.ownerEmail || project.client_email}</strong>'s account since {formatDateTime(project.handed_over_at)}.</p>
          <p className="mt-1 text-[12px] text-ink-tertiary">To make changes now, use Admin › Customers › View as user.</p>
          <button type="button" onClick={resend} disabled={!!busy} className={`${BTN} mt-3`}>{busy === 'email' ? 'Sending…' : 'Resend access email'}</button>
        </div>
      ) : !site ? (
        <p className="text-[13px] text-ink-tertiary">Once the site is designed, hand it to {first}'s own account here: bookings, customers and payments then go to them.</p>
      ) : account === undefined ? (
        <p className="text-[13px] text-ink-tertiary">Checking {project.client_email}…</p>
      ) : (
        <div className="text-[13px]">
          {account ? (
            <p className="text-[#1a1a1a]">
              {first} has an account ({account.email}){account.isPro ? ' on Pro' : ''}.
              {account.sites.filter((s) => s.type === 'website').length > 0 && (
                <span className="block mt-1 text-amber-800">
                  They already have a website ({account.sites.filter((s) => s.type === 'website').map((s) => s.name || 'unnamed').join(', ')}). This becomes another one.
                </span>
              )}
            </p>
          ) : (
            <p className="text-[#1a1a1a]">{first} doesn't have an account yet. We'll create one for {project.client_email}.</p>
          )}
          {!account?.isPro && (
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={compPro} onChange={(e) => setCompPro(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
              <span>Include Pro <span className="block text-[11px] text-ink-tertiary">Bookings, deposits and payments. Bookings switch off on a free account.</span></span>
            </label>
          )}
          <label className="mt-2 flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
            <span>Email {first} {account ? 'that it\'s in their account' : 'a link to set their password'}</span>
          </label>
          {!site.publishedUrl && <p className="mt-2 text-[12px] text-amber-800">The site isn't published yet. Publish it from the editor first so it's live when they sign in.</p>}
          <button type="button" onClick={handOver} disabled={!!busy || project.design_status === 'generating'} className={`${BTN_PRIMARY} mt-3`}>
            {busy === 'handover' ? 'Handing over…' : `Hand over to ${first}`}
          </button>
        </div>
      )}
    </section>
  );
}
