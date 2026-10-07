import { useCallback, useEffect, useRef, useState } from 'react';
import { convertHeic, customSiteAdmin } from '../../lib/customSites.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { formatDateTime, timeAgo } from './customSiteUi.jsx';

// Project page: the customer's iPhone photos (HEIC/HEIF). Most browsers
// can't show them on a site, Claude can't see them (Suggest a design, the
// Launch Kit) and the Design step can't import them. This card counts them
// and starts the server's conversion to JPEG (custom-site-admin
// heic-convert, which starts the background function), watches the run and
// shows what came back. The run is project.design.heic:
//   { status: 'running'|'ready'|'failed', startedAt, finishedAt, converted,
//     failed: [{ path, name, reason }], by: 'admin'|'customer' }
// A converted file takes the HEIC one's place in project.assets (same spot
// in the customer's list) and carries convertedFrom: <the old path>. The
// customer's form starts a run too when they save with HEIC files in it,
// so a run can already be going when the page opens.
//
//   project    the page's project (assets or files, design.heic, updated_at)
//   onRefresh  () => void: reload the page's project, once a run this card
//              watched has ended, so the files list and thumbnails show
//              the JPEGs

// Same rule as the server (netlify/functions/_lib/heic-run.js isHeicAsset):
// one of the four upload kinds, a HEIC/HEIF type or extension, and not a
// file the conversion already wrote. Kept here so the browser never pulls
// in the functions' code; the test checks both copies agree (this one and
// isHeicRunLive below).
export const HEIC_KINDS = Object.freeze(['photo', 'logo', 'brand', 'reference']);
const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const HEIC_EXT = /\.hei[cf]$/i;

export function isHeicAsset(asset) {
  if (!asset || typeof asset !== 'object' || !HEIC_KINDS.includes(asset.kind)) return false;
  if (typeof asset.path !== 'string' || !asset.path || asset.convertedFrom) return false;
  const type = String(asset.type || '').trim().toLowerCase();
  return HEIC_TYPES.includes(type) || HEIC_EXT.test(String(asset.name || '')) || HEIC_EXT.test(asset.path);
}

// The uploads still to convert, in the customer's order.
export function heicAssetsOf(assets) {
  return (Array.isArray(assets) ? assets : []).filter(isHeicAsset);
}

// The background function has 15 minutes; a run still marked running after
// that died (timeout, lost invocation) and the button can start another.
// Date.parse, because Postgres hands the time back as '+00:00', not 'Z'.
export const HEIC_RUN_LIVE_MS = 15 * 60 * 1000;
export const HEIC_POLL_MS = 4000;

export function isHeicRunLive(run, nowMs = Date.now()) {
  if (!run || typeof run !== 'object' || run.status !== 'running') return false;
  const started = Date.parse(run.startedAt || '');
  return Number.isFinite(started) && nowMs - started < HEIC_RUN_LIVE_MS;
}

const isRun = (r) => !!r && typeof r === 'object' && typeof r.status === 'string';
const time = (iso) => Date.parse(iso || '') || 0;

// Of two records of the run (the page's project, the card's own poll, the
// answer to the button), the one to show: the later start, and for the same
// run the finished record (a run only goes from running to ready or failed).
export function newerHeicRun(a, b) {
  const x = isRun(a) ? a : null;
  const y = isRun(b) ? b : null;
  if (!x || !y) return x || y;
  if (time(x.startedAt) !== time(y.startedAt)) return time(y.startedAt) > time(x.startedAt) ? y : x;
  return x.status === 'running' && y.status !== 'running' ? y : x;
}

// Polls can cross, and the page refreshes the project on its own too: the
// copy saved last wins (updated_at), the first one on a tie.
export function newerProject(a, b) {
  if (!a || !b) return a || b || null;
  return time(b.updated_at) > time(a.updated_at) ? b : a;
}

// What the card shows for these uploads and this run:
//   state    'none' (nothing to show), 'idle' (HEIC files, no run yet),
//            'running', 'stale' (marked running past 15 minutes), 'ready',
//            'failed'
//   pending  the HEIC uploads still to convert
//   failed   the files the run couldn't convert ({ name, reason })
export function heicCardView({ assets, run, nowMs = Date.now() } = {}) {
  const pending = heicAssetsOf(assets);
  const r = isRun(run) ? run : null;
  const failed = (Array.isArray(r?.failed) ? r.failed : [])
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({ name: String(f.name || f.path || 'unnamed'), reason: String(f.reason || '') }));
  let state = 'none';
  if (r) {
    if (r.status === 'running') state = isHeicRunLive(r, nowMs) ? 'running' : 'stale';
    else state = r.status === 'failed' ? 'failed' : 'ready';
  } else if (pending.length) {
    state = 'idle';
  }
  const converted = Number.isFinite(r?.converted) && r.converted > 0 ? Math.floor(r.converted) : 0;
  return { state, pending, failed, converted, run: r };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const runKey = (r) => (isRun(r) ? `${r.startedAt || ''}|${r.status}` : '');

const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors';

export default function HeicConvertCard({ project, onRefresh }) {
  const { confirm } = useAlert();
  const projectId = project?.id || '';
  // The project as the card's own polls last fetched it, the run the
  // button's answer returned (the page's project doesn't show it until the
  // next load), and a message from the last press.
  const [fetched, setFetched] = useState(null);
  const [started, setStarted] = useState(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const latest = newerProject(project, fetched);
  const run = newerHeicRun(latest?.design?.heic, started);
  const assets = Array.isArray(latest?.assets) ? latest.assets : latest?.files;
  const view = heicCardView({ assets, run, nowMs: now });
  const live = view.state === 'running';

  // The card polls `get` itself rather than reloading the page: every load
  // signs the file links again, and new links would reload every thumbnail
  // on the page every few seconds while the run goes.
  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await customSiteAdmin('get', { id: projectId });
      if (alive.current && res?.project) setFetched((prev) => newerProject(prev, res.project));
    } catch {
      // A network blip: the next poll asks again.
    }
  }, [projectId]);

  // While the run is going: ask every few seconds, and move the clock (which
  // also turns a run that never answers into "stale" and stops the polls).
  useEffect(() => {
    if (!live) return undefined;
    const poll = setInterval(() => {
      setNow(Date.now());
      load();
    }, HEIC_POLL_MS);
    return () => clearInterval(poll);
  }, [live, load]);

  // A poll saw the run end while the page still shows the project from
  // before: reload the page once per outcome, so the files list, the
  // thumbnails and the activity log show the JPEGs.
  const refreshedFor = useRef('');
  const fetchedRun = fetched?.design?.heic;
  const fetchedKey = runKey(fetchedRun);
  const fetchedLive = isHeicRunLive(fetchedRun, now);
  const propKey = runKey(project?.design?.heic);
  useEffect(() => {
    if (!fetchedKey || fetchedLive || fetchedKey === propKey || fetchedKey === refreshedFor.current) return;
    refreshedFor.current = fetchedKey;
    refreshRef.current?.();
  }, [fetchedKey, fetchedLive, propKey]);

  async function start() {
    const n = view.pending.length;
    const ok = await confirm(
      `Each one is replaced by a JPEG copy (at most 2560 px on its longest side) in the same place in the customer's files, and the HEIC original is deleted. It runs on the server, so you can leave this page.`,
      { title: `Convert ${plural(n, 'iPhone photo', 'iPhone photos')} to JPEG?`, confirmText: 'Convert' },
    );
    if (!ok) return;
    setStarting(true);
    setNotice('');
    try {
      const res = await convertHeic(projectId);
      if (!alive.current) return;
      setNow(Date.now());
      if (res?.heic) setStarted(res.heic);
    } catch (e) {
      if (!alive.current) return;
      if (e?.status === 409 && e.data?.heic) {
        // One is already going (the customer's form may have started it):
        // watch that one.
        setNow(Date.now());
        setStarted(e.data.heic);
      } else {
        setNotice(e?.message || 'Could not start the conversion.');
        // "Nothing to convert": the files changed since the page loaded.
        if (e?.status === 400) refreshRef.current?.();
      }
    } finally {
      if (alive.current) setStarting(false);
    }
  }

  if (view.state === 'none' && !notice) return null;

  const { state, pending, failed, converted } = view;
  const by = run?.by === 'customer' ? ' when the customer saved their form' : '';
  // Set by a run that stopped early (time limit) with files left over.
  const note = (state === 'ready' || state === 'failed') && typeof run.note === 'string' ? run.note : '';
  // A finished run with nothing left to do and nothing to report: one line.
  const quiet = state === 'ready' && !pending.length && !failed.length && !notice && !note;

  return (
    <section className={`bg-white rounded-2xl border border-black/[0.07] ${quiet ? 'px-5 py-3.5 sm:px-6' : 'p-5 sm:p-6'}`}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${quiet ? '' : 'mb-3'}`}>
        <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">iPhone photos</h3>
        {quiet && (
          <p className="text-[13px] text-[#1a1a1a]">
            {converted > 0 ? `Converted ${plural(converted, 'photo', 'photos')} from HEIC to JPEG` : 'Nothing left to convert'}
            {run.finishedAt && <span className="text-ink-tertiary"> · {formatDateTime(run.finishedAt)}</span>}
          </p>
        )}
      </div>

      {state === 'running' && (
        <div className="flex items-center gap-4 rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-3.5" role="status">
          <span className="w-5 h-5 border-[3px] border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1a1a1a]">Converting iPhone photos to JPEG…</p>
            <p className="text-[12px] text-ink-tertiary">
              {pending.length > 0 ? `${pending.length} left. ` : ''}
              Started {timeAgo(run.startedAt)}{by}. You can leave this page; it keeps going.
            </p>
          </div>
        </div>
      )}

      {state === 'stale' && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-900">
          The last conversion didn&apos;t finish (it may have timed out).
          {converted > 0 ? ` It converted ${plural(converted, 'photo', 'photos')} before it stopped.` : ''}
        </p>
      )}

      {state === 'failed' && (
        <div className="rounded-xl bg-[#fff5f5] border border-[#cc0000]/20 px-4 py-3">
          <p className="text-[14px] font-semibold text-[#cc0000]">The conversion stopped</p>
          <p className="mt-0.5 text-[13px] text-[#4a4a4a]">
            {typeof run.error === 'string' && run.error ? run.error : 'Something went wrong.'}
            {converted > 0 ? ` It converted ${plural(converted, 'photo', 'photos')} before it stopped.` : ''}
          </p>
        </div>
      )}

      {/* A run that converted nothing and failed nothing says "Nothing left
          to convert" only when that is true: HEIC files uploaded after it
          (a save while it ran starts no second run) get the prompt alone. */}
      {state === 'ready' && !quiet && (converted > 0 || failed.length > 0 || !pending.length) && (
        <p className="text-[14px] font-semibold text-[#1a1a1a]">
          {converted > 0 ? `Converted ${plural(converted, 'photo', 'photos')} from HEIC to JPEG` : failed.length ? 'No photos were converted' : 'Nothing left to convert'}
          {run.finishedAt && <span className="font-normal text-[12px] text-ink-tertiary"> · {formatDateTime(run.finishedAt)}</span>}
        </p>
      )}
      {note && <p className="mt-1 text-[13px] text-[#4a4a4a]">{note}</p>}

      {state !== 'running' && failed.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-[#cc0000]">Couldn&apos;t convert {plural(failed.length, 'file', 'files')}:</p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-[#4a4a4a]">
            {failed.map((f, i) => (
              <li key={`${f.name}-${i}`} className="break-words"><span className="font-semibold text-[#1a1a1a]">{f.name}</span>{f.reason ? `: ${f.reason}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {state !== 'running' && pending.length > 0 && (
        <div className={`flex flex-wrap items-center gap-3 ${state === 'idle' ? '' : 'mt-4'}`}>
          <p className="min-w-0 flex-1 text-[14px] text-[#1a1a1a]">
            {`${plural(pending.length, 'iPhone photo', 'iPhone photos')} (HEIC) can't be shown on a website or seen by Claude.`}
          </p>
          <button type="button" onClick={start} disabled={starting} className={BTN_PRIMARY}>
            {starting ? 'Starting…' : pending.length === 1 ? 'Convert it to JPEG' : 'Convert them to JPEG'}
          </button>
        </div>
      )}

      {notice && <p className="mt-3 text-[13px] text-[#cc0000]" role="alert">{notice}</p>}
    </section>
  );
}
