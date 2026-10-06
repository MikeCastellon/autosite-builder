import { useEffect, useMemo, useRef, useState } from 'react';
import { customSiteSuggest } from '../../../lib/customSites.js';
import {
  SUGGESTION_PARTS, applySuggestion, changedParts, isSuggestRunLive, matchContextFor, matchPalettePlan, referenceLabel, skippedGroups,
} from '../../../lib/designSuggest.js';
import { sectionLabel } from '../../../data/templateSections.js';
import { TEMPLATES } from '../../../data/templates.js';
import ReferenceShotUpload from './ReferenceShotUpload.jsx';
import { paletteSourceText, wholeShotName } from './referenceMatch.js';

// Design Studio: "Suggest a design". Claude looks at the customer's logo,
// reference screenshots and photos plus their answers, and proposes the
// template, palette, fonts, sections, layouts, photo picks and facts (each
// fact with the customer's own words). Nothing is applied until the admin
// ticks the parts to take and presses Apply; Save / Write then stores it.
//
//   project   the project (design.suggestion is the last run)
//   current   { templateId, levers, slots } of the setup page
//   onApply   ({ templateId, levers, slots }) => void
//   reference optional: the page's reference choice (design.reference,
//             { mode: 'inspire' | 'match', source }), sent on start. In
//             'match' mode Claude mirrors that one reference's layout
//             from its screenshot; the colors come from our side (the
//             Studio palette sent with it, the brand system or their
//             brand colors) and the logo, photos and words stay theirs.
//   onReferenceAdded optional: (asset, project) => void. When a match has
//             no screenshot to look at, the panel offers the upload and
//             hands each recorded screenshot to the page.
//   useBrand  optional: the page's "Use their brand color" toggle as it is
//             now (maybe not saved yet). A match says and sends it, so the
//             run takes their brand color only when the page does; absent,
//             the saved design.useBrand decides (designSuggest.js
//             matchPalettePlan).
//   uploading optional: screenshots are being uploaded elsewhere on the
//             page. A match waits for them (and for this panel's own
//             upload): a tall screenshot goes up in parts, and a run
//             started after the first one would see only the top.

const POLL_MS = 5000;
const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors';
const PART_LABELS = { template: 'Template', palette: 'Colors', fonts: 'Fonts', sections: 'Sections', layout: 'Layouts', photos: 'Photo picks', facts: 'Facts' };
const ROLE_LABELS = { bg: 'Background', secondary: 'Surface', text: 'Text', muted: 'Muted', accent: 'Accent' };
const FACT_LABELS = {
  tagline: 'Tagline', yearsInBusiness: 'Years in business', warranty: 'Warranty', awards: 'Award', certifications: 'Certification',
  paymentMethods: 'Payment method', serviceAreas: 'Service area', insured: 'Insured',
};

export default function SuggestPanel({
  project, current, onApply, modelName = 'Claude', disabled = false, reference = null, onReferenceAdded, useBrand, uploading = false,
}) {
  const [suggestion, setSuggestion] = useState(project.design?.suggestion || null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [take, setTake] = useState({});
  const [factPicks, setFactPicks] = useState([]);
  const [applied, setApplied] = useState(false);
  const live = isSuggestRunLive(suggestion);
  const timer = useRef(null);
  // Bumped after every check, so a failed check (a network blip) still
  // schedules the next one.
  const [polls, setPolls] = useState(0);

  // Poll while a run is live; stop on unmount.
  useEffect(() => {
    if (!live) return undefined;
    timer.current = setTimeout(async () => {
      try {
        const res = await customSiteSuggest('get', { id: project.id });
        setSuggestion(res.suggestion || null);
        setError('');
      } catch (e) {
        setError(e.message || 'Could not check the suggestion');
      } finally {
        setPolls((n) => n + 1);
      }
    }, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [live, polls, project.id]);

  // "Match its layout": what it will look at, where the colors come from,
  // and what's missing before it can run (the server checks the same).
  const matching = reference?.mode === 'match';
  const studioPalette = current?.levers?.palette;
  // Only a real toggle overrides the saved one.
  const brandToggle = typeof useBrand === 'boolean' ? useBrand : undefined;
  const matchInfo = useMemo(
    () => (matching ? matchContextFor(project, { reference, studioPalette, useBrand: brandToggle }) : null),
    [matching, project, reference, studioPalette, brandToggle],
  );
  const blocked = matching && !!matchInfo?.error;
  // The upload offered for a match without a screenshot stays once used,
  // until another reference is picked: the first part recorded already
  // lifts the block, and the panel must still show the other parts going
  // up, what of a long page was left out, and any failure.
  const sourceKey = matching ? JSON.stringify(reference?.source ?? null) : '';
  const [uploadFor, setUploadFor] = useState('');
  const [ownUpload, setOwnUpload] = useState(false);
  const needsShot = blocked && ['no-shot', 'unviewable'].includes(matchInfo?.problem);
  const showUpload = !!onReferenceAdded && matching && (needsShot || (!!uploadFor && uploadFor === sourceKey));
  const onUploadBusy = (busy) => {
    setOwnUpload(busy);
    if (busy) setUploadFor(sourceKey);
  };
  // A match waits until every part is recorded (an inspiration run, as before, doesn't).
  const waiting = matching && (ownUpload || !!uploading);
  // A cut-up screenshot is named as the one it came from (any part brings
  // them all).
  const matchLabel = matching ? wholeShotName(matchInfo?.match?.label || referenceLabel(reference?.source, project.assets)) : '';
  // Said even while the match can't run yet (no screenshot).
  const palettePlan = matching ? matchInfo?.match?.palette || matchPalettePlan(project, studioPalette, { useBrand: brandToggle }) : null;

  const ready = suggestion?.status === 'ready';
  const changed = useMemo(() => {
    if (!ready) return [];
    const parts = changedParts(current, suggestion);
    // Sections are made for the suggested template, so on their own they
    // change nothing when the template differs; taken with it, they do.
    const hasSections = !!(suggestion.levers?.sections?.order?.length || suggestion.levers?.sections?.hidden?.length);
    if (hasSections && parts.includes('template') && !parts.includes('sections')) parts.push('sections');
    return parts;
  }, [ready, current, suggestion]);
  // A fresh result: tick every part that changes something, and every fact.
  const resultKey = ready ? suggestion.finishedAt || suggestion.startedAt : '';
  useEffect(() => {
    if (!resultKey) return;
    setTake(Object.fromEntries(SUGGESTION_PARTS.map((p) => [p, true])));
    setFactPicks((suggestion.facts || []).map((_, i) => i));
    setApplied(false);
  }, [resultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setError('');
    setStarting(true);
    try {
      const payload = { id: project.id };
      if (reference && typeof reference === 'object') payload.reference = { mode: reference.mode, source: reference.source ?? null };
      // The Studio's colors and the brand-color toggle as they are on the
      // page (maybe not saved yet): a match keeps them.
      if (matching) {
        payload.palette = studioPalette || {};
        if (brandToggle !== undefined) payload.useBrand = brandToggle;
      }
      const res = await customSiteSuggest('start', payload);
      setSuggestion(res.suggestion || null);
    } catch (e) {
      if (e.data?.suggestion) setSuggestion(e.data.suggestion);
      setError(e.message || 'Could not start');
    } finally {
      setStarting(false);
    }
  }

  function apply() {
    const parts = Object.fromEntries(SUGGESTION_PARTS.map((p) => [p, take[p] !== false && changed.includes(p)]));
    // Without the template, the suggested sections don't fit the page.
    if (!parts.template && changedParts(current, suggestion).includes('template')) parts.sections = false;
    parts.facts = take.facts !== false && changed.includes('facts') ? factPicks : false;
    onApply(applySuggestion(current, suggestion, parts));
    setApplied(true);
  }

  const files = new Map((project.files || []).filter((f) => f.url).map((f) => [f.path, f]));
  const templateId = ready && suggestion.templateId ? suggestion.templateId : current.templateId;

  const shotCount = matchInfo?.match?.shots?.length || 0;
  const idleLabel = matching
    ? (ready ? 'Match again' : `Match the layout with ${modelName}`)
    : (ready ? 'Suggest again' : `Suggest a design with ${modelName}`);

  return (
    <div>
      {matching ? (
        <p className="text-[13px] text-[#4a4a4a]">
          {modelName} looks at {shotCount > 1 ? 'the screenshots' : shotCount === 1 ? 'the screenshot' : 'a screenshot'} of <span className="font-semibold">{matchLabel}</span> and
          lays their site out like it: the closest template, the section order, the hero and about layouts, and fonts with the same feel.
          Colors come from {paletteSourceText(palettePlan)}, and the logo, photos and words stay theirs.
          Only layout and type feel are copied, never its text, photos, logo or brand.
          Nothing changes until you pick what to take. Takes about 1-3 minutes and uses AI credits.
        </p>
      ) : (
        <p className="text-[13px] text-[#4a4a4a]">
          {modelName} looks at their logo, reference screenshots and photos, reads their answers, and proposes the whole look.
          Nothing changes until you pick what to take. Takes about 1-3 minutes and uses AI credits.
        </p>
      )}
      {(blocked || showUpload) && (
        <div className="mt-3 space-y-2">
          {blocked && <p role="status" className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">{matchInfo.error}</p>}
          {/* Same place in the tree whether or not the block is shown, so
              the upload isn't remounted (and its progress lost) when its
              first part lifts the block. */}
          {showUpload && (
            <ReferenceShotUpload
              projectId={project.id}
              sourceUrl={reference?.source?.kind === 'url' ? reference.source.url : ''}
              onAdded={onReferenceAdded}
              onBusy={onUploadBusy}
              disabled={disabled}
            />
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={start} disabled={disabled || starting || live || blocked || waiting} className={ready ? BTN : BTN_PRIMARY}>
          {live ? 'Thinking…' : starting ? 'Starting…' : idleLabel}
        </button>
        {waiting && !live && (
          <span role="status" className="text-[12px] text-ink-tertiary">Waiting for the screenshots to finish uploading, so the match sees every part.</span>
        )}
        {live && (
          <span role="status" className="text-[12px] text-ink-tertiary">
            {suggestion?.reference?.mode === 'match' ? 'Claude is studying the reference\'s layout.' : 'Claude is looking at their files.'} You can keep working; this updates on its own.
          </span>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-[#cc0000]">{error}</p>}
      {suggestion?.status === 'failed' && (
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
          The last suggestion didn't finish{suggestion.error ? `: ${suggestion.error}` : ''}. Try again.
        </p>
      )}

      {ready && (
        <div className="mt-4 space-y-3">
          {suggestion.reference?.mode === 'match' && <MatchSummary suggestion={suggestion} files={files} />}
          {SUGGESTION_PARTS.map((part) => {
            const has = changed.includes(part);
            return (
              <div key={part} className={`rounded-xl border p-3 ${has ? 'border-black/[0.10]' : 'border-black/[0.05] opacity-60'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={has && take[part] !== false}
                    disabled={!has}
                    onChange={(e) => setTake((t) => ({ ...t, [part]: e.target.checked }))}
                    className="w-4 h-4 accent-[#cc0000]"
                  />
                  <span className="text-[13px] font-bold text-[#1a1a1a]">{PART_LABELS[part]}</span>
                  {!has && <span className="text-[11px] text-ink-tertiary">No change</span>}
                </label>
                <div className="pl-6">
                  {suggestion.reasons?.[part] && <p className="text-[12px] text-ink-tertiary">{suggestion.reasons[part]}</p>}
                  <PartDetail part={part} suggestion={suggestion} templateId={templateId} files={files} factPicks={factPicks} setFactPicks={setFactPicks} />
                </div>
              </div>
            );
          })}
          {Array.isArray(suggestion.skipped) && suggestion.skipped.length > 0 && <SkippedFiles skipped={suggestion.skipped} />}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={apply} disabled={disabled || changed.length === 0} className={BTN_PRIMARY}>Apply the ticked parts</button>
            {applied && <span role="status" className="text-[12px] text-[#4a4a4a]">Applied below. Check the preview, then Save or write the site.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// What a "Match its layout" result mirrored, above the parts to take.
function MatchSummary({ suggestion, files }) {
  const ref = suggestion.reference;
  const shots = (Array.isArray(ref.shots) ? ref.shots : []).map((s) => files.get(s.path)).filter(Boolean);
  return (
    <div className="rounded-xl border border-black/[0.10] bg-black/[0.02] p-3">
      <p className="text-[13px] font-bold text-[#1a1a1a]">Matched the layout of {wholeShotName(ref.label) || 'the reference'}</p>
      {suggestion.reasons?.reference && <p className="mt-0.5 text-[12px] text-[#4a4a4a]">{suggestion.reasons.reference}</p>}
      {shots.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-2">
          {shots.map((f) => <img key={f.path} src={f.url} alt={f.name} className="w-16 h-16 rounded-md object-cover object-top border border-black/10" />)}
        </span>
      )}
      <p className="mt-1.5 text-[11px] text-ink-tertiary">
        Only its layout and type feel were used: the colors are from our side, and its text, photos, logo and brand stay out.
      </p>
    </div>
  );
}

// What Claude didn't see: one line per reason with a count, the file names
// behind a toggle.
function SkippedFiles({ skipped }) {
  const groups = skippedGroups(skipped);
  const total = groups.reduce((n, g) => n + g.files.length, 0);
  return (
    <div className="text-[12px] text-ink-tertiary">
      <p className="font-semibold text-[#4a4a4a]">Not shown to Claude ({total} {total === 1 ? 'file' : 'files'}):</p>
      <ul className="mt-0.5 space-y-0.5">
        {groups.map((g) => <li key={g.reason}>{g.files.length} × {g.reason}</li>)}
      </ul>
      <details className="mt-1">
        <summary className="cursor-pointer select-none text-[#4a4a4a] hover:text-[#1a1a1a]">Show the files</summary>
        <ul className="mt-1 max-h-48 overflow-y-auto space-y-0.5 break-all">
          {groups.flatMap((g) => g.files.map((f, i) => (
            <li key={`${g.reason}-${i}`}>{f.name}{f.reason && f.reason !== g.reason ? ` (${f.reason})` : ''}</li>
          )))}
        </ul>
      </details>
    </div>
  );
}

function PartDetail({ part, suggestion, templateId, files, factPicks, setFactPicks }) {
  const l = suggestion.levers || {};
  if (part === 'template') {
    const t = TEMPLATES[suggestion.templateId];
    return t ? <span className="block mt-1 text-[12px] text-[#4a4a4a]">{t.label}</span> : null;
  }
  if (part === 'palette') {
    const roles = Object.entries(l.palette || {});
    if (!roles.length) return null;
    return (
      <span className="mt-1.5 flex flex-wrap gap-2">
        {roles.map(([role, hex]) => (
          <span key={role} className="inline-flex items-center gap-1 text-[11px] text-[#4a4a4a]">
            <span className="w-4 h-4 rounded border border-black/15" style={{ background: hex }} aria-hidden="true" />
            {ROLE_LABELS[role] || role} {hex}
          </span>
        ))}
      </span>
    );
  }
  if (part === 'fonts') {
    return l.fonts?.heading || l.fonts?.body
      ? <span className="block mt-1 text-[12px] text-[#4a4a4a]">{l.fonts.heading || 'template heading'} / {l.fonts.body || 'template body'}</span>
      : null;
  }
  if (part === 'sections') {
    const order = l.sections?.order || [];
    const hidden = l.sections?.hidden || [];
    if (!order.length && !hidden.length) return null;
    return (
      <span className="block mt-1 text-[12px] text-[#4a4a4a]">
        {order.filter((id) => !hidden.includes(id)).map((id) => sectionLabel(templateId, id)).join(' → ')}
        {hidden.length > 0 && <span className="text-ink-tertiary"> · hidden: {hidden.map((id) => sectionLabel(templateId, id)).join(', ')}</span>}
      </span>
    );
  }
  if (part === 'layout') {
    const bits = [l.heroLayout && `Hero: ${l.heroLayout === 'split' ? 'split' : 'full'}`, l.aboutLayout && `About: ${l.aboutLayout === 'stats' ? 'stats' : 'photo'}`].filter(Boolean);
    return bits.length ? <span className="block mt-1 text-[12px] text-[#4a4a4a]">{bits.join(' · ')}</span> : null;
  }
  if (part === 'photos') {
    const plan = suggestion.photoPlan || {};
    const shown = [['Hero', plan.hero], ['About', plan.about], ...(plan.gallery || []).map((p, i) => [`Gallery ${i + 1}`, p])].filter(([, p]) => p);
    if (!shown.length) return null;
    return (
      <span className="mt-1.5 flex flex-wrap gap-2">
        {shown.map(([label, path]) => {
          const f = files.get(path);
          return (
            <span key={`${label}-${path}`} className="w-16 text-center">
              {f ? <img src={f.url} alt={f.name} className="w-16 h-16 rounded-md object-cover border border-black/10" /> : <span className="block w-16 h-16 rounded-md bg-black/[0.05]" />}
              <span className="block mt-0.5 text-[10px] text-ink-tertiary truncate">{label}</span>
            </span>
          );
        })}
      </span>
    );
  }
  if (part === 'facts') {
    const facts = Array.isArray(suggestion.facts) ? suggestion.facts : [];
    if (!facts.length) return null;
    return (
      <span className="mt-1.5 block space-y-1.5">
        {facts.map((f, i) => (
          <label key={i} className="flex items-start gap-2 text-[12px] text-[#1a1a1a]">
            <input
              type="checkbox"
              checked={factPicks.includes(i)}
              onChange={(e) => setFactPicks((list) => (e.target.checked ? [...list, i] : list.filter((x) => x !== i)))}
              className="mt-0.5 w-3.5 h-3.5 accent-[#cc0000]"
            />
            <span>
              <span className="font-semibold">{FACT_LABELS[f.field] || f.field}:</span> {f.field === 'insured' ? 'Yes' : f.value}
              <span className="block text-ink-tertiary">They wrote: "{f.quote}"</span>
            </span>
          </label>
        ))}
      </span>
    );
  }
  return null;
}
