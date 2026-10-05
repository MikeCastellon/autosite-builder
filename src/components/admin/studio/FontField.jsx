import { useEffect, useId, useState } from 'react';
import { pairingFor, rankPairings } from '../../../data/fontPairings.js';
import { fontStack } from '../../../lib/designLevers.js';
import { BTN_SMALL, HINT, INPUT, LABEL, applyPairing, fontLinkHrefs, fontOptionGroups, setFontSlot, toFamily } from './studioFields.js';

// Design Studio: heading and body fonts, as one of the curated pairings
// (src/data/fontPairings.js) or any catalog family per slot, with a
// sample line in each font.
//
// Controlled over levers.fonts:
//   value        { heading?, body? } (FONT_CATALOG family names; a missing
//                slot keeps the template's font)
//   onChange     (nextFonts) => void
//   defaults     the template's fonts, as families or CSS stacks:
//                { heading: TEMPLATES[id].font, body: TEMPLATES[id].bodyFont }
//   styles, businessType, mood
//                what the pairings are ranked by (rankPairings): the
//                intake's style picks, the business type, the template mood
//   sample       heading sample text, e.g. the business name

const SHOWN_PAIRINGS = 6;
const BODY_SAMPLE = 'Interior and exterior detailing, paint correction and ceramic coatings. Pick a package and a time that suits you.';

// Each family's Google Fonts stylesheet, added to the head once per page
// load. Admin only: the published site gets its fonts from exportHtml.
// Links stay after the field unmounts so going back and forth doesn't
// refetch, and the browser downloads font files only for text using them.
const loaded = new Set();
function useFontLinks(families) {
  const key = fontLinkHrefs(families).join('\n');
  useEffect(() => {
    for (const href of key ? key.split('\n') : []) {
      if (loaded.has(href)) continue;
      loaded.add(href);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.studioFont = '';
      document.head.appendChild(link);
    }
  }, [key]);
}

export default function FontField({ value, onChange, defaults, styles, businessType, mood, sample }) {
  const [showAll, setShowAll] = useState(false);
  const fonts = value || {};
  const base = { heading: toFamily(defaults?.heading), body: toFamily(defaults?.body) };
  const heading = toFamily(fonts.heading) || base.heading;
  const body = toFamily(fonts.body) || base.body;
  const headingSample = (typeof sample === 'string' && sample.trim()) || 'Paint correction & ceramic coating';

  const ranked = rankPairings({ styles, businessType, mood });
  const active = pairingFor(fonts);
  let visible = showAll ? ranked : ranked.slice(0, SHOWN_PAIRINGS);
  // The active pairing stays on screen even when it ranks lower.
  if (active && !visible.some((p) => p.id === active.id)) visible = [...visible, ranked.find((p) => p.id === active.id)];
  const best = ranked[0]?.score > 0 ? ranked[0].id : '';

  useFontLinks([heading, body, ...visible.flatMap((p) => [p.heading, p.body])]);

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1a1a1a]">Pairings</p>
      <p className="text-[11px] text-ink-tertiary">A heading font and a body font picked to work together. Best matches for their style come first.</p>
      <ul className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((p) => {
          const on = active?.id === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(applyPairing(p))}
                aria-pressed={on}
                className={`w-full h-full text-left rounded-xl border p-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40 ${on ? 'border-[#cc0000] bg-[#cc0000]/[0.05]' : 'border-black/[0.08] hover:border-[#cc0000]/40'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-tertiary">{p.name}</span>
                  {p.id === best && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#cc0000]">Best match</span>}
                </span>
                <span className="block mt-1.5 text-[20px] leading-tight font-bold text-[#1a1a1a] truncate" style={{ fontFamily: fontStack(p.heading) }}>
                  {headingSample}
                </span>
                <span className="block mt-1 text-[13px] leading-snug text-[#4a4a4a] line-clamp-2" style={{ fontFamily: fontStack(p.body) }}>
                  {BODY_SAMPLE}
                </span>
                <span className="block mt-2 text-[11px] font-semibold text-[#1a1a1a]">{p.heading} + {p.body}</span>
                <span className="block mt-0.5 text-[11px] leading-snug text-ink-tertiary">{p.note}</span>
                {p.reasons.length > 0 && <span className="block mt-1 text-[11px] text-[#4a4a4a]">{p.reasons.join(' · ')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {ranked.length > SHOWN_PAIRINGS && (
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className={`${BTN_SMALL} mt-3`}>
          {showAll ? 'Show fewer pairings' : `Show all ${ranked.length} pairings`}
        </button>
      )}

      <p className="mt-5 text-[12px] font-semibold text-[#1a1a1a]">Or pick each font</p>
      <div className="mt-2 grid sm:grid-cols-2 gap-3">
        <FontSelect slot="heading" label="Heading font" hint="Titles, the hero and section headings." value={fonts.heading} fallback={base.heading} onPick={(f) => onChange(setFontSlot(fonts, 'heading', f))} />
        <FontSelect slot="body" label="Body font" hint="Paragraphs, prices and everything small." value={fonts.body} fallback={base.body} onPick={(f) => onChange(setFontSlot(fonts, 'body', f))} />
      </div>

      <div className="mt-4 rounded-xl border border-black/[0.08] bg-[#faf9f7] px-4 py-4" aria-label="Font sample" role="group">
        <p className="text-[24px] leading-tight font-bold text-[#1a1a1a] break-words" style={{ fontFamily: fontStack(heading) || undefined }}>
          {headingSample}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#4a4a4a]" style={{ fontFamily: fontStack(body) || undefined }}>
          {BODY_SAMPLE}
        </p>
        <p className="mt-3 text-[11px] text-ink-tertiary">
          Heading: {describeSlot(fonts.heading, base.heading)} · Body: {describeSlot(fonts.body, base.body)}
        </p>
      </div>

      {(toFamily(fonts.heading) || toFamily(fonts.body)) && (
        <button type="button" onClick={() => onChange({})} className={`${BTN_SMALL} mt-3`}>
          Use the template's fonts
        </button>
      )}
    </div>
  );
}

// "Fraunces", or "Inter (template)" when the slot keeps the template's.
function describeSlot(picked, fallback) {
  const family = toFamily(picked);
  if (family) return family;
  return fallback ? `${fallback} (template)` : 'the template\'s font';
}

function FontSelect({ slot, label, hint, value, fallback, onPick }) {
  const id = useId();
  const groups = fontOptionGroups(slot, value);
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <select id={id} value={toFamily(value)} onChange={(e) => onPick(e.target.value)} aria-describedby={`${id}-hint`} className={INPUT}>
        <option value="">{fallback ? `Template default (${fallback})` : 'Template default'}</option>
        {groups.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {g.families.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
          </optgroup>
        ))}
      </select>
      <span id={`${id}-hint`} className={HINT}>{hint}</span>
    </div>
  );
}
