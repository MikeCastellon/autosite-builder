import { useId } from 'react';
import {
  BTN_SMALL, INPUT, MAX_STATS, STAT_LIMITS, addStat, incompleteStats, layoutOptions, layoutPart, removeStat, setStat,
} from './studioFields.js';

// Design Studio: the hero and About layouts, and the About stats.
//
// Controlled over the layout slice of the levers:
//   templateId  the chosen template; layoutOptions() says which controls
//               reach it (no Full/Split for Redline, layouts only on
//               theme-ready templates, stats where the template reads them)
//   value       { heroLayout, aboutLayout, aboutStats } (the levers object
//               itself works too: only these keys are read)
//   onChange    (nextSlice) => void, the same three keys; merge it in:
//               onChange={(part) => setLevers((l) => ({ ...l, ...part }))}

const HERO_CHOICES = [
  { value: '', label: 'Template default' },
  { value: 'full', label: 'Full', hint: 'Photo across the top, text over it' },
  { value: 'split', label: 'Split', hint: 'Text beside the photo' },
];

const ABOUT_CHOICES = [
  { value: '', label: 'Template default' },
  { value: 'image', label: 'Photo', hint: 'Their About photo' },
  { value: 'stats', label: 'Stats', hint: 'A box of their numbers' },
];

// A typed rating would drift from the real one (the Google badge brings
// that), so the examples stick to numbers only the owner knows.
const STAT_PLACEHOLDERS = [['e.g. 12', 'Years in business'], ['e.g. 2,000', 'Cars detailed'], ['e.g. 3', 'Team members']];

export default function LayoutField({ templateId, value, onChange }) {
  const opts = layoutOptions(templateId);
  const part = layoutPart(value);
  const set = (patch) => onChange({ ...part, ...patch });
  const incomplete = incompleteStats(part.aboutStats);

  if (!opts.hero && !opts.about && !opts.stats) {
    return <p className="text-[13px] text-ink-tertiary">This template has no layout options. Pick a newer template for hero and About layouts.</p>;
  }

  return (
    <div className="space-y-5">
      {opts.hero && (
        <Choice legend="Hero" name="hero" choices={HERO_CHOICES} value={part.heroLayout} onPick={(v) => set({ heroLayout: v })} />
      )}
      {opts.about && (
        <Choice legend="About section" name="about" choices={ABOUT_CHOICES} value={part.aboutLayout} onPick={(v) => set({ aboutLayout: v })} />
      )}
      {opts.stats && (
        <div>
          <p className="text-[12px] font-semibold text-[#1a1a1a]">About stats <span className="font-normal text-ink-tertiary">({part.aboutStats.length} of {MAX_STATS})</span></p>
          <p className="mt-0.5 text-[11px] text-ink-tertiary leading-snug">
            Stats must be facts the owner gave you (their years in business, cars done, team size). Never estimate or round up.{' '}
            {!opts.about
              ? 'They show where the template has a stats box.'
              : part.aboutLayout === 'stats'
                ? 'They fill the About box; the photo shows until one is complete.'
                : 'With the Photo layout they show elsewhere on the page (a stats strip, the hero, or under the About text).'}
          </p>
          <ul className="mt-2 space-y-2">
            {part.aboutStats.map((s, i) => (
              <StatRow
                key={i}
                index={i}
                stat={s}
                incomplete={incomplete.includes(i)}
                onEdit={(patch) => set({ aboutStats: setStat(part.aboutStats, i, patch) })}
                onRemove={() => set({ aboutStats: removeStat(part.aboutStats, i) })}
              />
            ))}
          </ul>
          {part.aboutStats.length < MAX_STATS && (
            <button type="button" onClick={() => set({ aboutStats: addStat(part.aboutStats) })} className={`${BTN_SMALL} mt-2`}>
              + Add a stat
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// A row of radio buttons drawn as a segmented control: arrow keys move
// between them like any radio group.
function Choice({ legend, name, choices, value, onPick }) {
  const id = useId();
  return (
    <fieldset>
      <legend className="text-[12px] font-semibold text-[#1a1a1a] mb-1.5">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <label key={c.value || 'default'} className="cursor-pointer">
            <input
              type="radio"
              name={`${id}-${name}`}
              value={c.value}
              checked={value === c.value}
              onChange={() => onPick(c.value)}
              className="peer sr-only"
            />
            <span className="block rounded-lg border px-3 py-2 text-[13px] border-black/[0.12] text-[#1a1a1a] hover:border-[#cc0000]/40 peer-checked:border-[#cc0000] peer-checked:bg-[#cc0000]/[0.05] peer-focus-visible:ring-2 peer-focus-visible:ring-[#cc0000]/40">
              <span className="block font-semibold">{c.label}</span>
              {c.hint && <span className="block text-[11px] text-ink-tertiary">{c.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StatRow({ index, stat, incomplete, onEdit, onRemove }) {
  const n = index + 1;
  const [valueHint, labelHint] = STAT_PLACEHOLDERS[index] || ['', ''];
  return (
    <li>
      <div className="flex gap-2">
        <input
          type="text"
          value={stat?.value ?? ''}
          onChange={(e) => onEdit({ value: e.target.value })}
          maxLength={STAT_LIMITS.value}
          placeholder={valueHint}
          aria-label={`Stat ${n} number`}
          className={`${INPUT} max-w-[110px]`}
        />
        <input
          type="text"
          value={stat?.label ?? ''}
          onChange={(e) => onEdit({ label: e.target.value })}
          maxLength={STAT_LIMITS.label}
          placeholder={labelHint}
          aria-label={`Stat ${n} label`}
          className={INPUT}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove stat ${n}`}
          className="w-9 shrink-0 rounded-lg text-[18px] text-ink-tertiary hover:text-[#cc0000] hover:bg-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40"
        >
          ×
        </button>
      </div>
      {incomplete && <p className="mt-1 text-[11px] text-amber-800">Needs both a number and a label, or the site leaves it out.</p>}
    </li>
  );
}
