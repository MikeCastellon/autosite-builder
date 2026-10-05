import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { brandToLevers } from '../../../lib/brandSpec.js';
import {
  BRAND_POLL_MS, brandAdjustments, brandChoices, brandContrastChecks, brandFonts, brandLogo, brandNotes, brandReasons,
  brandRunError, brandRunNotes, brandRunState, choiceInUse, elapsedLabel, getBrandRun, leversWithBrand, modelLabel,
  newerBrandRun, startBrandRun, usageLabel,
} from '../../../lib/customSiteBrand.js';
import { useAlert } from '../../ui/AlertProvider.jsx';
import { formatDateTime } from '../customSiteUi.jsx';
import { BTN, PALETTE_ROLES, fontLinkHrefs, ratioLabel } from './studioFields.js';

// Design setup: "Build brand system". Claude runs the launch-brand-system
// skill over the customer's logo, brand files and reference screenshots
// plus their style answers (server: custom-site-brand), and this card shows
// what came back: the brand board, the palette with its light and dark
// versions, the font pair and why. "Use this palette and fonts" hands the
// setup new levers (palette + fonts from brandToLevers); nothing reaches the
// site until the setup is saved and the site written. See
// src/lib/customSiteBrand.js.
//
//   projectId  the custom_site_projects id
//   brand      project.design.brand as the page loaded it (the card also
//              fetches its own copy, which carries the board's signed link)
//   levers     the setup's current design.levers
//   onApply    (nextLevers) => void
//   onRefresh  () => void: reload the project (after a start, and once
//              the server has a finished run the project doesn't show yet)

const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40 focus-visible:ring-offset-2';
const HEADING_SAMPLE = 'Paint correction & ceramic coating';
const BODY_SAMPLE = 'Interior and exterior detailing, done right. Pick a package and a time that suits you.';
const ROLE_LABELS = Object.fromEntries(PALETTE_ROLES.map((r) => [r.role, r.label]));

// Each family's Google Fonts stylesheet, added to the head once (FontField
// adds the same links: an existing one is reused). Admin only: the
// published site gets its fonts from exportHtml.
function useFontLinks(families) {
  const key = fontLinkHrefs(families).join('\n');
  useEffect(() => {
    for (const href of key ? key.split('\n') : []) {
      const exists = [...document.head.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.getAttribute('href') === href);
      if (exists) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.studioFont = '';
      document.head.appendChild(link);
    }
  }, [key]);
}

// The conversion lives in brandSpec.js; if it throws, the card still applies
// the palette it shows (leversWithBrand's fallback) rather than nothing.
function convert(spec, which) {
  try {
    return brandToLevers(spec, which);
  } catch (e) {
    console.error('[BrandSystemCard] brandToLevers failed:', e);
    return null;
  }
}

export default function BrandSystemCard({ projectId, brand, levers, onApply, onRefresh }) {
  const { confirm } = useAlert();
  const headingId = useId();
  // design.brand as this card last fetched it, and the board's signed link
  // (kept with the path it signs, so an old link never shows a newer run).
  const [fetched, setFetched] = useState(null);
  const [board, setBoard] = useState({ path: '', url: '' });
  const [brokenUrl, setBrokenUrl] = useState('');
  const [setup, setSetup] = useState({ configured: true, message: '' });
  const [starting, setStarting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState('');
  const [announce, setAnnounce] = useState('');

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const run = newerBrandRun(brand, fetched);
  const state = brandRunState(run, now);
  const spec = state === 'ready' ? run.brand : null;

  // Takes one answer from the server. Answers can cross while polling, so
  // the newer record wins (newerBrandRun), never simply the last to arrive.
  const take = useCallback((view) => {
    setSetup({ configured: view.configured, message: view.message });
    if (view.run) setFetched((prev) => newerBrandRun(prev, view.run));
    // A finished run's board, with an empty link when the server couldn't
    // sign one: the card then says the image can't load instead of
    // "Loading" for good.
    if (view.run?.status === 'ready' && view.run.boardPath) setBoard({ path: view.run.boardPath, url: view.boardUrl || '' });
  }, []);

  const inFlight = useRef(0);
  const load = useCallback(async () => {
    inFlight.current += 1;
    try {
      const view = await getBrandRun(projectId);
      if (!alive.current) return;
      take(view);
      setRequestError('');
    } catch (e) {
      if (alive.current) setRequestError(e.message || 'Could not check the brand system.');
    } finally {
      inFlight.current -= 1;
    }
  }, [projectId, take]);

  // Once on open: whether the skill is set up, and the board's signed link.
  useEffect(() => {
    setFetched(null);
    setBoard({ path: '', url: '' });
    setBrokenUrl('');
    setRequestError('');
    load();
  }, [load]);

  // While Claude works: ask every few seconds, and tick the clock (which
  // also turns a run that never answers into "stale").
  const running = state === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const poll = setInterval(load, BRAND_POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [running, load]);

  // The server has a finished run the page's project doesn't show yet (one
  // this card watched, or one that ended before the card opened): the page
  // reloads the project so the rest of the setup and the activity log see
  // it. Once per run outcome, so a project that lags can't cause a loop.
  const refreshedFor = useRef('');
  const propKey = brand?.status ? `${brand.startedAt || ''}|${brand.status}` : '';
  useEffect(() => {
    if (!fetched || fetched.status === 'running') return;
    const key = `${fetched.startedAt || ''}|${fetched.status}`;
    if (key === propKey || key === refreshedFor.current) return;
    refreshedFor.current = key;
    refreshRef.current?.();
  }, [fetched, propKey]);

  // A new run starts from its recommended palette.
  const runKey = run?.startedAt || '';
  useEffect(() => { setPicked(''); }, [runKey]);

  // The page's project shows a board this card has no link for yet (a run
  // that finished while the card wasn't polling). Not while a request is out:
  // its answer brings the link.
  const boardPath = state === 'ready' ? run.boardPath || '' : '';
  useEffect(() => {
    if (boardPath && board.path !== boardPath && inFlight.current === 0) load();
  }, [boardPath, board.path, load]);

  // A signed link that stopped working (custom-site-brand signs them for
  // 10 minutes): one fresh link per board, then the card says the image
  // can't load.
  const reloadedFor = useRef('');
  function boardFailed() {
    setBrokenUrl(board.url);
    if (reloadedFor.current !== board.path) {
      reloadedFor.current = board.path;
      load();
    }
  }

  async function build() {
    if (state === 'ready') {
      const ok = await confirm(
        'Claude reads the customer\'s files again and builds a new brand system, which replaces the one shown here. Colors and fonts you already applied stay until you apply new ones. Uses AI credits.',
        { title: 'Build a new brand system?', confirmText: 'Build' },
      );
      if (!ok) return;
    }
    setStarting(true);
    setRequestError('');
    try {
      const view = await startBrandRun(projectId);
      if (!alive.current) return;
      take(view);
      if (view.alreadyRunning && !view.run) load();
      if (view.configured) refreshRef.current?.();
    } catch (e) {
      if (!alive.current) return;
      setRequestError(e.message || 'Could not start the brand system.');
      // The server may have recorded the failed start: show its state.
      load();
    } finally {
      if (alive.current) setStarting(false);
    }
  }

  const choices = spec ? brandChoices(spec) : [];
  const fonts = spec ? brandFonts(spec) : { heading: '', body: '' };
  const inUse = choiceInUse(choices, levers, fonts);
  const choice = choices.find((c) => c.id === picked) || choices.find((c) => c.id === inUse) || choices[0] || null;
  const reasons = spec ? brandReasons(spec) : null;
  const logo = spec ? brandLogo(spec) : null;
  const notes = spec ? brandNotes(spec) : [];
  const adjustments = spec ? brandAdjustments(spec) : [];
  const runNotes = brandRunNotes(run);
  const checks = choice ? brandContrastChecks(choice.palette) : [];
  const hasFonts = !!(fonts.heading || fonts.body);

  useFontLinks([fonts.heading, fonts.body]);

  function apply() {
    if (!choice || inUse === choice.id) return;
    const next = leversWithBrand(levers, convert(spec, choice.which), { palette: choice.palette, fonts });
    onApply?.(next);
    setAnnounce(`${choice.label} palette${hasFonts ? ' and fonts' : ''} applied to the setup.`);
  }

  const canBuild = setup.configured && !starting && state !== 'running';
  const buildLabel = starting ? 'Starting…' : state === 'failed' || state === 'stale' ? 'Try again' : state === 'ready' ? 'Build a new one' : 'Build brand system';
  const boardUrl = board.path === boardPath && board.url !== brokenUrl ? board.url : '';
  // The server answered for this board without a working link (none signed,
  // or the fresh one failed too). A board not asked about yet is "Loading".
  const boardUnavailable = board.path === boardPath && !boardUrl;

  return (
    <section aria-labelledby={headingId} className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <h3 id={headingId} className="text-[16px] font-[800] text-[#1a1a1a]">Brand system</h3>
          <p className="mt-0.5 text-[13px] text-ink-tertiary">
            A palette, a font pair and a brand board, built from the customer's logo and references.
          </p>
        </div>
        {setup.configured && (state === 'ready' || state === 'idle') && (
          <button type="button" onClick={build} disabled={!canBuild} className={state === 'ready' ? BTN : BTN_PRIMARY}>
            {buildLabel}
          </button>
        )}
      </div>

      {!setup.configured && (
        <div className="mt-4 rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-3.5" role="status">
          <p className="text-[14px] font-semibold text-[#1a1a1a]">Not set up yet</p>
          <p className="mt-0.5 text-[13px] text-[#4a4a4a]">
            {setup.message || 'The brand skill isn\'t connected on the server yet (CUSTOM_SITE_BRAND_SKILL_ID and CUSTOM_SITE_BRAND_SKILL_VERSION in Netlify).'}
            {' '}Until then, pick the colors and fonts by hand below.
          </p>
        </div>
      )}

      {requestError && (
        <p className="mt-3 rounded-lg bg-[#fff5f5] border border-[#cc0000]/20 px-3 py-2 text-[12px] text-[#cc0000]" role="alert">
          {requestError}
        </p>
      )}

      {state === 'idle' && setup.configured && (
        <p className="mt-4 text-[13px] text-[#4a4a4a]">
          Claude reads the customer's logo, brand files and reference screenshots plus their style answers, and proposes the five
          colors (with a light and a dark version), a heading and body font from our catalog, and a brand board to share.
          It takes about a minute and uses AI credits. Nothing changes on the site until you apply it and save.
        </p>
      )}

      {state === 'running' && (
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-4" role="status" aria-live="polite">
          <span className="w-6 h-6 border-[3px] border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1a1a1a]">Claude is building the brand system…</p>
            <p className="text-[12px] text-ink-tertiary">
              Reading the logo and references. Usually about a minute; you can leave this page, it keeps going.
              {' '}<span aria-hidden="true">{elapsedLabel(run, now)}</span>
            </p>
          </div>
        </div>
      )}

      {(state === 'failed' || state === 'stale') && (
        <div className="mt-4 rounded-xl bg-[#fff5f5] border border-[#cc0000]/20 px-4 py-3.5" role="alert">
          <p className="text-[14px] font-semibold text-[#cc0000]">The brand system didn't get built</p>
          <p className="mt-0.5 text-[13px] text-[#4a4a4a]">
            {state === 'stale' ? 'The run stopped answering (it may have timed out).' : brandRunError(run)}
          </p>
          {setup.configured && (
            <button type="button" onClick={build} disabled={!canBuild} className={`${BTN_PRIMARY} mt-3`}>{buildLabel}</button>
          )}
        </div>
      )}

      {spec && (
        <div className="mt-5 space-y-5">
          <p className="text-[12px] text-ink-tertiary">
            Built {formatDateTime(run.finishedAt)}{run.model ? ` with ${modelLabel(run.model)}` : ''}
            {usageLabel(run.usage) ? ` · ${usageLabel(run.usage)}` : ''}
          </p>

          {boardPath && (
            boardUrl ? (
              <a href={boardUrl} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-black/[0.08] bg-[#faf9f7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40">
                <img
                  src={boardUrl}
                  alt="Brand board: the palette with hex codes and contrast ratios, the font pair and the logo"
                  width={1600}
                  height={1000}
                  loading="lazy"
                  onError={boardFailed}
                  className="block w-full h-auto"
                />
                <span className="sr-only"> (opens full size in a new tab)</span>
              </a>
            ) : (
              <div className="flex items-center justify-center aspect-[16/10] rounded-xl border border-dashed border-black/[0.12] bg-[#faf9f7] px-4 text-center text-[12px] text-ink-tertiary">
                {boardUnavailable ? 'The brand board image couldn\'t load. Reload the page to try again.' : 'Loading the brand board…'}
              </div>
            )
          )}

          {/* The server repairs what the skill got wrong after the board
              was drawn: say where the board and the stored colors differ. */}
          {adjustments.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[12px] text-amber-900">
              <p className="font-semibold">Changed after the board was made</p>
              <ul className="mt-1 space-y-0.5">
                {adjustments.map((a, i) => (
                  <li key={i}>
                    <span className="font-semibold">{a.what}</span>
                    {a.from && a.to ? <span className="font-mono"> {a.from} → {a.to}</span> : a.from ? <span className="font-mono"> ({a.from})</span> : null}
                    {`: ${a.reason}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {choices.length > 1 && (
            <fieldset>
              <legend className="text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Palette</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {choices.map((c) => (
                  <label key={c.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`${headingId}-choice`}
                      value={c.id}
                      checked={choice?.id === c.id}
                      onChange={() => setPicked(c.id)}
                      className="peer sr-only"
                    />
                    <span className="block h-full rounded-lg border px-3 py-2.5 border-black/[0.12] hover:border-[#cc0000]/40 peer-checked:border-[#cc0000] peer-checked:bg-[#cc0000]/[0.05] peer-focus-visible:ring-2 peer-focus-visible:ring-[#cc0000]/40">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#1a1a1a]">{c.label}</span>
                        {inUse === c.id && (
                          <span className="inline-flex px-1.5 py-px rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-800">In use</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-ink-tertiary">{c.hint}</span>
                      <span className="mt-2 flex h-5 rounded overflow-hidden border border-black/10" aria-hidden="true">
                        {PALETTE_ROLES.map(({ role }) => <span key={role} className="flex-1" style={{ background: c.palette[role] }} />)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {choice && (
            <div>
              <ul className="grid grid-cols-2 sm:grid-cols-5 gap-2" aria-label={`${choice.label} colors`}>
                {PALETTE_ROLES.map(({ role }) => (
                  <li key={role} className="min-w-0">
                    <span className="block h-12 rounded-lg border border-black/10" style={{ background: choice.palette[role] }} aria-hidden="true" />
                    <span className="mt-1 block text-[12px] font-semibold text-[#1a1a1a] truncate">{ROLE_LABELS[role]}</span>
                    <span className="block text-[11px] font-mono text-ink-tertiary">{choice.palette[role]}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label="Readability">
                {checks.map((c) => (
                  <li key={c.id} className="text-[12px] text-[#4a4a4a]">
                    {c.label}{' '}
                    <span className={`font-semibold ${c.pass ? 'text-emerald-800' : 'text-[#cc0000]'}`}>
                      {ratioLabel(c.ratio)}{c.pass ? '' : ' (low)'}
                    </span>
                    {c.adjusted && <span className="text-ink-tertiary"> (auto-fixed)</span>}
                  </li>
                ))}
              </ul>
              {/* The reasons are about the recommended palette: say so while
                  an alternate is on screen, so its hex codes aren't read as
                  the ones explained. */}
              {(reasons.palette || reasons.accent) && (
                <div className="mt-3 space-y-1 text-[13px] text-[#4a4a4a]">
                  {choice.id !== 'main' && (
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">About the recommended palette</p>
                  )}
                  {reasons.palette && <p>{reasons.palette}</p>}
                  {reasons.accent && <p><span className="font-semibold text-[#1a1a1a]">Accent: </span>{reasons.accent}</p>}
                </div>
              )}
            </div>
          )}

          {hasFonts && (
            <div className="rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-3.5">
              <p className="text-[12px] font-semibold text-[#1a1a1a]">Fonts</p>
              <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                {fonts.heading && (
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Headings: {fonts.heading}</dt>
                    <dd className="mt-0.5 text-[22px] leading-tight font-bold text-[#1a1a1a] break-words" style={{ fontFamily: `'${fonts.heading}', sans-serif` }}>
                      {HEADING_SAMPLE}
                    </dd>
                  </div>
                )}
                {fonts.body && (
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Body: {fonts.body}</dt>
                    <dd className="mt-0.5 text-[14px] leading-relaxed text-[#4a4a4a]" style={{ fontFamily: `'${fonts.body}', sans-serif` }}>
                      {BODY_SAMPLE}
                    </dd>
                  </div>
                )}
              </dl>
              {reasons.fonts && <p className="mt-2.5 text-[13px] text-[#4a4a4a]">{reasons.fonts}</p>}
            </div>
          )}

          {(logo || notes.length > 0 || runNotes.skipped.length > 0 || runNotes.warnings.length > 0) && (
            <div className="text-[12px] text-[#4a4a4a] space-y-1.5">
              {logo && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#1a1a1a]">From the logo</span>
                  {logo.dominant.length > 0 && (
                    <ul className="flex gap-1" aria-label="Logo colors">
                      {logo.dominant.map((h) => (
                        <li key={h} title={h} className="w-4 h-4 rounded border border-black/15" style={{ background: h }}>
                          <span className="sr-only">{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="text-ink-tertiary">
                    {[
                      logo.background && `${logo.background} background`,
                      logo.hasText === true ? 'has lettering' : logo.hasText === false ? 'symbol only' : '',
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
              {notes.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5">
                  {notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
              {runNotes.skipped.length > 0 && (
                <div>
                  <p className="font-semibold text-[#1a1a1a]">Not used</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {runNotes.skipped.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}
              {runNotes.warnings.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5 text-ink-tertiary">
                  {runNotes.warnings.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          )}

          {choice && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 border-t border-black/[0.06]">
              {/* aria-disabled, not disabled: the button keeps keyboard focus
                  after the click that puts the palette in use. */}
              <button type="button" onClick={apply} aria-disabled={inUse === choice.id || undefined} className={`${BTN_PRIMARY} aria-disabled:opacity-60 aria-disabled:cursor-default aria-disabled:hover:bg-[#cc0000]`}>
                {inUse === choice.id ? 'In use' : hasFonts ? 'Use this palette and fonts' : 'Use this palette'}
              </button>
              <p className="min-w-0 flex-1 basis-56 text-[12px] text-ink-tertiary">
                {inUse === choice.id
                  ? 'The colors and fonts below are this brand system\'s.'
                  : `Replaces the colors${hasFonts ? ' and fonts' : ''} set below. You can still change any of them after.`}
              </p>
              <span className="sr-only" role="status" aria-live="polite">{announce}</span>
            </div>
          )}

          {!setup.configured && (
            <p className="text-[12px] text-ink-tertiary">A new brand system can be built once the skill is set up.</p>
          )}
        </div>
      )}
    </section>
  );
}
