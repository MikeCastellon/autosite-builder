import { Component, Suspense, lazy, useCallback, useEffect, useId, useRef, useState } from 'react';
import { KIT_GROUPS, KIT_SKILLS, kitNeedLabel, kitOf, kitOutdatedUses, kitSkill } from '../../lib/launchKit.js';
import {
  KIT_POLL_MS, elapsedLabel, getKit, kitBuildConfirm, kitReadyRuns, kitRunError, kitRunNotes, kitTile, mergeKit,
  modelLabel, newerKitRun, projectWithKit, signOffClaims, startKitRun, usageLabel,
} from '../../lib/customSiteKit.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { formatDateTime } from './customSiteUi.jsx';
import { BTN, BTN_SMALL } from './studio/studioFields.js';
import GenericResult from './kit/GenericResult.jsx';

// The "Launch kit" section of a custom website project: one tile per
// Launch Kit skill (src/lib/launchKit.js KIT_SKILLS), each a Claude Agent
// Skill run on the server (custom-site-kit, custom-site-kit-background).
// A tile shows the run's state, Build / Rebuild (with the cost and a
// confirm), what it needs first, its files (thumbnails and download links,
// kit/GenericResult.jsx), the skill's notes and the server's warnings, the
// error with Try again, and the skill's own result view
// (kit/<Key>Result.jsx, default export, props { run, project, urls }),
// loaded on demand. A view that is missing, fails to load or throws while
// rendering leaves the generic file list on its own. See
// src/lib/customSiteKit.js.
//
//   projectId  the custom_site_projects id
//   project    the project as the page loaded it (design.kit, site_id,
//              design.brand for the "needs" checks)
//   onRefresh  () => void: reload the project (after a start, and once the
//              server has a finished run the project doesn't show yet)

const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40 focus-visible:ring-offset-2';
// Signed file links last 10 minutes: fetch fresh ones a little before.
const LINKS_REFRESH_MS = 9 * 60 * 1000;

// ─── Per-skill result views ───────────────────────────────────────────

// Every kit/*Result.jsx that exists at build time, loaded on first use. A
// glob rather than one import() per skill: a skill whose view isn't written
// yet just has none, instead of breaking the build. (GenericResult is
// imported above, on every tile.)
const VIEW_LOADERS = import.meta.glob(['./kit/*Result.jsx', '!./kit/GenericResult.jsx']);
const VIEWS = new Map();

export function resultViewPath(key) {
  return `./kit/${key.charAt(0).toUpperCase()}${key.slice(1)}Result.jsx`;
}

function ViewUnavailable() {
  return <p className="text-[12px] text-ink-tertiary">The detailed view couldn't load; the files above are the result.</p>;
}

// The lazy component for a skill's view, or null when there is none.
function resultView(key) {
  const load = VIEW_LOADERS[resultViewPath(key)];
  if (!load) return null;
  if (!VIEWS.has(key)) {
    VIEWS.set(key, lazy(() => load()
      .then((m) => (typeof m?.default === 'function' ? m : { default: ViewUnavailable }))
      .catch((err) => {
        console.error(`[LaunchKitPanel] ${key} view failed to load:`, err);
        return { default: ViewUnavailable };
      })));
  }
  return VIEWS.get(key);
}

// A view that throws while rendering shows the fallback, not a blank page.
class ViewBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[LaunchKitPanel] result view failed:', error);
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? <ViewUnavailable /> : this.props.children;
  }
}

// ─── A tile ───────────────────────────────────────────────────────────

const PILL = {
  idle: ['Not built', 'bg-black/[0.05] text-[#4a4a4a]'],
  running: ['Building…', 'bg-amber-50 text-amber-900'],
  ready: ['Ready', 'bg-emerald-50 text-emerald-800'],
  failed: ['Failed', 'bg-[#fff5f5] text-[#cc0000]'],
  stale: ['Failed', 'bg-[#fff5f5] text-[#cc0000]'],
  off: ['Not set up', 'bg-black/[0.05] text-ink-tertiary'],
};

function KitTile({ entry, run, tile, project, urls, now, error, onBuild, viewProps = {} }) {
  const headingId = useId();
  const { state } = tile;
  const pill = PILL[tile.configured === false && state !== 'ready' ? 'off' : state] || PILL.idle;
  const { notes, warnings } = kitRunNotes(run);
  const View = state === 'ready' ? resultView(entry.key) : null;
  const uses = entry.uses.map(kitNeedLabel);
  // Built before something it reads was rebuilt (or the site rewritten).
  const outdated = state === 'ready' ? kitOutdatedUses(entry.key, project, run).map((u) => u.label) : [];
  const showBuild = tile.configured !== false && state !== 'running';

  return (
    <li aria-labelledby={headingId} className="rounded-xl border border-black/[0.08] bg-white px-4 py-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={headingId} className="text-[14px] font-[800] text-[#1a1a1a]">{entry.label}</h4>
            <span className={`inline-flex px-1.5 py-px rounded-full text-[10px] font-bold uppercase tracking-wide ${pill[1]}`}>{pill[0]}</span>
          </div>
          <p className="mt-0.5 text-[12px] text-[#4a4a4a]">{entry.blurb}</p>
        </div>
        {showBuild && (
          <div className="flex flex-col items-end gap-0.5">
            <button
              type="button"
              onClick={() => onBuild(entry.key, state)}
              disabled={!tile.canBuild}
              className={state === 'ready' ? BTN : BTN_PRIMARY}
            >
              {tile.buildLabel}
            </button>
            {entry.estimate && <span className="text-[11px] text-ink-tertiary">{entry.estimate} per run</span>}
          </div>
        )}
      </div>

      {tile.configured === false && (
        <p className="mt-2 text-[12px] text-ink-tertiary" role="status">{tile.notSetUp || 'Not set up on the server yet.'}</p>
      )}
      {tile.needs.length > 0 && state !== 'running' && (
        <p className="mt-2 text-[12px] font-semibold text-amber-900">
          Needs {tile.needs.map((n) => n.label).join(' and ')} first.
        </p>
      )}
      {uses.length > 0 && state !== 'running' && (
        <p className="mt-1 text-[11px] text-ink-tertiary">Also uses, when ready: {uses.join(', ')}.</p>
      )}
      {outdated.length > 0 && (
        <p className="mt-1 text-[12px] font-semibold text-amber-900" role="status">
          Built before the latest {outdated.join(' and ')}: rebuild to bring it up to date.
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-lg bg-[#fff5f5] border border-[#cc0000]/20 px-3 py-2 text-[12px] text-[#cc0000]" role="alert">{error}</p>
      )}

      {state === 'running' && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-[#faf9f7] border border-black/[0.06] px-3 py-3" role="status" aria-live="polite">
          <span className="w-5 h-5 border-[3px] border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />
          <p className="text-[12px] text-[#4a4a4a]">
            Claude is building it. A few minutes; you can leave this page, it keeps going.
            {' '}<span aria-hidden="true">{elapsedLabel(run, now)}</span>
          </p>
        </div>
      )}

      {(state === 'failed' || state === 'stale') && (
        <div className="mt-3 rounded-lg bg-[#fff5f5] border border-[#cc0000]/20 px-3 py-2.5" role="alert">
          <p className="text-[12px] font-semibold text-[#cc0000]">It didn't get built</p>
          <p className="mt-0.5 text-[12px] text-[#4a4a4a]">{kitRunError(run, now)}</p>
        </div>
      )}

      {state === 'ready' && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-ink-tertiary">
            Built {formatDateTime(run.finishedAt)}{run.model ? ` with ${modelLabel(run.model)}` : ''}
            {usageLabel(run.usage) ? ` · ${usageLabel(run.usage)}` : ''}
          </p>
          <GenericResult run={run} urls={urls} skill={entry.key} />
          {(notes.length > 0 || warnings.length > 0) && (
            <div className="text-[12px] text-[#4a4a4a] space-y-1">
              {notes.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5">
                  {notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
              {warnings.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5 text-amber-900">
                  {warnings.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          )}
          {View && (
            <details className="group rounded-lg border border-black/[0.06] bg-[#faf9f7] px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-semibold text-[#1a1a1a]">Show the details</summary>
              <div className="mt-2">
                <ViewBoundary resetKey={run.startedAt || ''}>
                  <Suspense fallback={<p className="text-[12px] text-ink-tertiary">Loading…</p>}>
                    <View run={run} project={project} urls={urls} {...viewProps} />
                  </Suspense>
                </ViewBoundary>
              </div>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

// ─── The panel ────────────────────────────────────────────────────────

// onApplyPhotos ({ hero, about, gallery }) => void | Promise: the photo
// desk's "Use these picks" (the page saves them as the setup's photos).
export default function LaunchKitPanel({ projectId, project, onRefresh, onApplyPhotos }) {
  const { confirm } = useAlert();
  const headingId = useId();
  // design.kit as this panel last fetched it, the signed links to the ready
  // runs' files, and which skills the server can run (null until it said).
  const [fetched, setFetched] = useState({});
  const [urls, setUrls] = useState({});
  const [setup, setSetup] = useState({ configured: null, notSetUp: {} });
  // Skills whose start request is on its way ({ [key]: true }): one per
  // tile, so a second tile's start can't re-enable the first's button.
  const [starting, setStarting] = useState({});
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  // The ready runs the current links were signed for (kitReadyRuns ids): a
  // poll that sees another one ready asks for links once.
  const linked = useRef(new Set());

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const kit = mergeKit(kitOf(project), fetched);
  const view = projectWithKit(project, fetched);

  // Takes one answer from the server. Answers can cross while polling, so
  // the newer record wins per skill (mergeKit), never simply the last.
  const take = useCallback((answer) => {
    if (answer.configured) {
      setSetup((prev) => ({
        configured: { ...(prev.configured || {}), ...answer.configured },
        notSetUp: { ...prev.notSetUp, ...(answer.notSetUp || {}) },
      }));
    }
    setFetched((prev) => mergeKit(prev, answer.kit));
  }, []);

  // links: false is the polls' read: the runs only. The links the panel has
  // stay valid for 10 minutes, and fresh ones (new tokens) would make every
  // thumbnail download again every few seconds. When a poll sees a run that
  // turned ready since the links were signed, it asks for them once (decided
  // here, from the answer, not from a render that may be behind).
  const load = useCallback(async ({ links = true } = {}) => {
    try {
      const answer = await getKit(projectId, { links });
      if (!alive.current) return;
      take(answer);
      const ready = kitReadyRuns(answer.kit);
      if (links) {
        // A get with links signs every ready run's files: they replace the old ones.
        setUrls(answer.urls);
        linked.current = new Set(ready);
      } else if (ready.some((id) => !linked.current.has(id))) {
        for (const id of ready) linked.current.add(id);
        load();
      }
      setRequestError('');
    } catch (e) {
      if (alive.current) setRequestError(e.message || 'Could not check the launch kit.');
    }
  }, [projectId, take]);

  // On open: the runs, the file links and what is set up; then fresh links
  // before the old ones expire.
  useEffect(() => {
    setFetched({});
    setUrls({});
    setErrors({});
    setRequestError('');
    linked.current = new Set();
    load();
    const links = setInterval(load, LINKS_REFRESH_MS);
    return () => clearInterval(links);
  }, [load]);

  // While Claude works: ask every few seconds (the runs only), and tick the
  // clock (which also turns a run that never answers into "stale").
  const running = KIT_SKILLS.some((s) => kitTile(s.key, { run: kit[s.key], project: view, nowMs: now }).state === 'running');
  useEffect(() => {
    if (!running) return undefined;
    const poll = setInterval(() => load({ links: false }), KIT_POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [running, load]);

  // The server has a finished run the page's project doesn't show yet: the
  // page reloads the project so the activity log (and the needs of the
  // other tiles) see it. Once per run outcome, so a lagging project can't
  // cause a loop.
  const refreshed = useRef(new Set());
  const pageKit = kitOf(project);
  const outcome = (run) => (run?.status && run.status !== 'running' ? `${run.startedAt || ''}|${run.status}` : '');
  const behind = KIT_SKILLS
    .filter(({ key }) => {
      const f = fetched[key];
      return outcome(f) && newerKitRun(pageKit[key], f) === f && outcome(pageKit[key]) !== outcome(f);
    })
    .map(({ key }) => `${key}|${outcome(fetched[key])}`)
    .join('\n');
  useEffect(() => {
    for (const id of behind ? behind.split('\n') : []) {
      if (refreshed.current.has(id)) continue;
      refreshed.current.add(id);
      refreshRef.current?.();
      return;
    }
  }, [behind]);

  async function build(key, state) {
    const ask = kitBuildConfirm(key, state === 'stale' ? 'failed' : state);
    if (ask && !(await confirm(ask.message, { title: ask.title, confirmText: ask.confirmText }))) return;
    setStarting((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      const answer = await startKitRun(projectId, key);
      if (!alive.current) return;
      take(answer);
      if (answer.needs.length) {
        setErrors((prev) => ({ ...prev, [key]: answer.message || `Needs ${answer.needs.map((n) => n.label).join(' and ')} first.` }));
      } else if (answer.configured?.[key] === false) {
        setErrors((prev) => ({ ...prev, [key]: answer.notSetUp?.[key] || 'Not set up on the server yet.' }));
      } else if (answer.alreadyRunning && !answer.run) {
        // A 409 without the live run: the claim didn't land (the project
        // kept changing while it was written). Say so, and show the state.
        setErrors((prev) => ({ ...prev, [key]: answer.message || 'It didn\'t start. Try again.' }));
        load();
      } else {
        refreshRef.current?.();
      }
    } catch (e) {
      if (!alive.current) return;
      setErrors((prev) => ({ ...prev, [key]: e.message || 'Could not start it.' }));
      // The server may have recorded the failed start: show its state.
      load();
    } finally {
      if (alive.current) setStarting((prev) => ({ ...prev, [key]: false }));
    }
  }

  // What a skill's own view can do beyond showing the result: the photo
  // desk's picks go to the setup, the claims check's sign-off is saved.
  const viewPropsFor = (key, run) => {
    if (key === 'photos' && typeof onApplyPhotos === 'function') return { onApply: onApplyPhotos };
    if (key === 'claims' && run?.status === 'ready') {
      return {
        onSignOff: async (signedOff) => {
          await signOffClaims(projectId, run.startedAt, signedOff);
          await load();
          refreshRef.current?.();
        },
      };
    }
    return {};
  };

  const readyCount = KIT_SKILLS.filter((s) => kitTile(s.key, { run: kit[s.key], project: view, nowMs: now }).state === 'ready').length;

  return (
    <section aria-labelledby={headingId} className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <h3 id={headingId} className="text-[16px] font-[800] text-[#1a1a1a]">Launch kit</h3>
          <p className="mt-0.5 text-[13px] text-ink-tertiary">
            The deliverables that come with the site, each built by Claude from the customer's answers, files and site.
            {' '}{readyCount} of {KIT_SKILLS.length} ready.
          </p>
        </div>
        <button type="button" onClick={() => load()} className={BTN_SMALL}>Refresh</button>
      </div>

      {requestError && (
        <p className="mt-3 rounded-lg bg-[#fff5f5] border border-[#cc0000]/20 px-3 py-2 text-[12px] text-[#cc0000]" role="alert">
          {requestError}
        </p>
      )}

      {KIT_GROUPS.map((tier) => {
        // In build order: what reads another part comes after it.
        const entries = tier.keys.map((k) => kitSkill(k)).filter(Boolean);
        if (!entries.length) return null;
        return (
          <div key={tier.id} className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#1a1a1a]">{tier.label}</p>
            <p className="text-[12px] text-ink-tertiary">{tier.hint}</p>
            <ul className="mt-2 space-y-3">
              {entries.map((entry) => {
                const run = kit[entry.key] || null;
                const tile = kitTile(entry.key, {
                  run,
                  project: view,
                  configured: setup.configured ? setup.configured[entry.key] ?? null : null,
                  notSetUp: setup.notSetUp[entry.key] || '',
                  starting: !!starting[entry.key],
                  nowMs: now,
                });
                return (
                  <KitTile
                    key={entry.key}
                    entry={entry}
                    run={run}
                    tile={tile}
                    project={project}
                    urls={urls[entry.key] || {}}
                    now={now}
                    error={errors[entry.key] || ''}
                    onBuild={build}
                    viewProps={viewPropsFor(entry.key, run)}
                  />
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
