import { applyLook, looksFor, lookIdFor } from '../../../data/designLooks.js';
import { hasLevers } from '../../../lib/designLevers.js';

// Design Studio: curated starting looks for the chosen template
// (src/data/designLooks.js). A look sets the style levers (palette, fonts,
// sections, layouts); business content in the levers stays. The admin can
// fine-tune everything below afterwards, and the card then reads
// "Customized".
//   onApply(nextLevers): the levers with the picked look's style applied.
export default function LooksPicker({ templateId, levers, onApply, disabled = false }) {
  const looks = looksFor(templateId);
  if (!looks.length) {
    return <p className="text-[13px] text-ink-tertiary">This template has no curated looks: set the colors and fonts below.</p>;
  }
  const current = lookIdFor(levers, templateId);
  const customized = !current && hasLevers(levers, templateId);
  return (
    <div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {looks.map((look) => {
          const on = current === look.id;
          const p = look.levers.palette;
          return (
            <li key={look.id}>
              <button
                type="button"
                onClick={() => onApply(applyLook(levers, look.id))}
                disabled={disabled}
                aria-pressed={on}
                className={`w-full h-full text-left rounded-xl border p-3.5 transition-colors disabled:opacity-60 ${on ? 'border-[#cc0000] bg-[#cc0000]/[0.05]' : 'border-black/[0.08] hover:border-[#cc0000]/40'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="flex overflow-hidden rounded-md border border-black/10" aria-hidden="true">
                    {[p.bg, p.secondary, p.accent, p.text].map((c, k) => <span key={k} className="w-4 h-7" style={{ background: c }} />)}
                  </span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{look.name}</span>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">{look.dark ? 'Dark' : 'Light'}</span>
                </span>
                <span className="block mt-1.5 text-[12px] text-[#4a4a4a]">{look.levers.fonts.heading} / {look.levers.fonts.body}</span>
                <span className="block mt-1 text-[12px] text-ink-tertiary leading-snug">{look.note}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {customized && <p className="mt-2 text-[12px] text-ink-tertiary">Customized: the settings below differ from every look.</p>}
    </div>
  );
}
