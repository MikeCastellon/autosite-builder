import { useEffect, useMemo, useRef, useState } from 'react';
import { customSiteSuggest } from '../../../lib/customSites.js';
import { SUGGESTION_PARTS, applySuggestion, changedParts, isSuggestRunLive } from '../../../lib/designSuggest.js';
import { sectionLabel } from '../../../data/templateSections.js';
import { TEMPLATES } from '../../../data/templates.js';

// Design Studio: "Suggest a design". Claude looks at the customer's logo,
// reference screenshots and photos plus their answers, and proposes the
// template, palette, fonts, sections, layouts, photo picks and facts (each
// fact with the customer's own words). Nothing is applied until the admin
// ticks the parts to take and presses Apply; Save / Write then stores it.
//
//   project   the project (design.suggestion is the last run)
//   current   { templateId, levers, slots } of the setup page
//   onApply   ({ templateId, levers, slots }) => void

const POLL_MS = 5000;
const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors';
const PART_LABELS = { template: 'Template', palette: 'Colors', fonts: 'Fonts', sections: 'Sections', layout: 'Layouts', photos: 'Photo picks', facts: 'Facts' };
const ROLE_LABELS = { bg: 'Background', secondary: 'Surface', text: 'Text', muted: 'Muted', accent: 'Accent' };
const FACT_LABELS = {
  tagline: 'Tagline', yearsInBusiness: 'Years in business', warranty: 'Warranty', awards: 'Award', certifications: 'Certification',
  paymentMethods: 'Payment method', serviceAreas: 'Service area', insured: 'Insured',
};

export default function SuggestPanel({ project, current, onApply, modelName = 'Claude', disabled = false }) {
  const [suggestion, setSuggestion] = useState(project.design?.suggestion || null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [take, setTake] = useState({});
  const [factPicks, setFactPicks] = useState([]);
  const [applied, setApplied] = useState(false);
  const live = isSuggestRunLive(suggestion);
  const timer = useRef(null);

  // Poll while a run is live; stop on unmount.
  useEffect(() => {
    if (!live) return undefined;
    timer.current = setTimeout(async () => {
      try {
        const res = await customSiteSuggest('get', { id: project.id });
        setSuggestion(res.suggestion || null);
      } catch (e) {
        setError(e.message || 'Could not check the suggestion');
      }
    }, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [live, suggestion, project.id]);

  const ready = suggestion?.status === 'ready';
  const changed = useMemo(() => (ready ? changedParts(current, suggestion) : []), [ready, current, suggestion]);
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
      const res = await customSiteSuggest('start', { id: project.id });
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
    parts.facts = take.facts !== false && changed.includes('facts') ? factPicks : false;
    onApply(applySuggestion(current, suggestion, parts));
    setApplied(true);
  }

  const files = new Map((project.files || []).filter((f) => f.url).map((f) => [f.path, f]));
  const templateId = ready && suggestion.templateId ? suggestion.templateId : current.templateId;

  return (
    <div>
      <p className="text-[13px] text-[#4a4a4a]">
        {modelName} looks at their logo, reference screenshots and photos, reads their answers, and proposes the whole look.
        Nothing changes until you pick what to take. Takes about 1-3 minutes and uses AI credits.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={start} disabled={disabled || starting || live} className={ready ? BTN : BTN_PRIMARY}>
          {live ? 'Thinking…' : starting ? 'Starting…' : ready ? 'Suggest again' : `Suggest a design with ${modelName}`}
        </button>
        {live && <span role="status" className="text-[12px] text-ink-tertiary">Claude is looking at their files. You can keep working; this updates on its own.</span>}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-[#cc0000]">{error}</p>}
      {suggestion?.status === 'failed' && (
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
          The last suggestion didn't finish{suggestion.error ? `: ${suggestion.error}` : ''}. Try again.
        </p>
      )}

      {ready && (
        <div className="mt-4 space-y-3">
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
          {Array.isArray(suggestion.skipped) && suggestion.skipped.length > 0 && (
            <p className="text-[12px] text-ink-tertiary">
              Not shown to Claude: {suggestion.skipped.map((s) => `${s.name || s.path}${s.reason ? ` (${s.reason})` : ''}`).join(', ')}.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={apply} disabled={disabled || changed.length === 0} className={BTN_PRIMARY}>Apply the ticked parts</button>
            {applied && <span role="status" className="text-[12px] text-[#4a4a4a]">Applied below. Check the preview, then Save or write the site.</span>}
          </div>
        </div>
      )}
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
