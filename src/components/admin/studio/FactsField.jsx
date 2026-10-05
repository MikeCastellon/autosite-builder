import { useId, useState } from 'react';
import { FACT_LISTS, FACT_TEXTS } from '../../../lib/designLevers.js';
import {
  FACT_LIST_FIELDS, FACT_TEXT_FIELDS, HINT, INPUT, LABEL, factTextWarning, formatFactList, insuredChoice, parseFactList, sameList,
  setFactList, setFactText, setInsured, splitFactList,
} from './studioFields.js';

// Design Studio: business facts the templates show only when the owner
// gave them (CLAUDE.md: no invented facts). An empty field stays off the
// site, so nothing here has a default.
//
// Controlled over levers.facts:
//   value     { tagline?, yearsInBusiness?, warranty?, awards?, certifications?,
//             paymentMethods?, serviceAreas?, insured? } (lists are arrays;
//             insured is true / false / missing = not said)
//   onChange  (nextFacts) => void

const INSURED_CHOICES = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: '', label: 'Not said' },
];

export default function FactsField({ value, onChange }) {
  const facts = value || {};
  const insuredId = useId();
  const insured = insuredChoice(facts);

  return (
    <div>
      <p className="text-[12px] text-[#4a4a4a]">Only facts they gave you. Anything left empty stays off the site.</p>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {FACT_TEXT_FIELDS.map((f) => (
          <TextFact key={f.key} field={f} value={facts[f.key]} onEdit={(text) => onChange(setFactText(facts, f.key, text))} />
        ))}
        <fieldset>
          <legend className={LABEL}>Insured</legend>
          <div className="flex flex-wrap gap-2">
            {INSURED_CHOICES.map((c) => (
              <label key={c.value || 'unsaid'} className="cursor-pointer">
                <input
                  type="radio"
                  name={`${insuredId}-insured`}
                  value={c.value}
                  checked={insured === c.value}
                  onChange={() => onChange(setInsured(facts, c.value))}
                  className="peer sr-only"
                />
                <span className="block rounded-lg border px-3 py-2 text-[13px] font-semibold border-black/[0.12] text-[#1a1a1a] hover:border-[#cc0000]/40 peer-checked:border-[#cc0000] peer-checked:bg-[#cc0000]/[0.05] peer-focus-visible:ring-2 peer-focus-visible:ring-[#cc0000]/40">
                  {c.label}
                </span>
              </label>
            ))}
          </div>
          <span className={HINT}>"Yes" only when they told you they carry insurance.</span>
        </fieldset>
        {FACT_LIST_FIELDS.map((f) => (
          <ListFact key={f.key} field={f} items={facts[f.key]} onEdit={(items) => onChange(setFactList(facts, f.key, items))} />
        ))}
      </div>
    </div>
  );
}

function TextFact({ field, value, onEdit }) {
  const id = useId();
  const text = value == null ? '' : String(value);
  const warning = factTextWarning(field.key, text);
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{field.label}</label>
      <input
        id={id}
        type="text"
        value={text}
        onChange={(e) => onEdit(e.target.value)}
        maxLength={FACT_TEXTS[field.key]}
        inputMode={field.key === 'yearsInBusiness' ? 'numeric' : undefined}
        aria-describedby={`${id}-hint`}
        aria-invalid={warning ? true : undefined}
        className={INPUT}
      />
      <span id={`${id}-hint`} className={HINT}>
        {field.hint}
        {warning && <span className="block text-amber-800">{warning}</span>}
      </span>
    </div>
  );
}

// A list typed as text ("A, B" or one per line). The text is kept as
// typed so commas and new lines don't vanish mid-word; the parsed items go
// up on every change, and the text is only replaced when the list changes
// from outside (a suggestion, a reset).
function ListFact({ field, items, onEdit }) {
  const id = useId();
  const list = Array.isArray(items) ? items : [];
  const key = list.join('\n');
  const [draft, setDraft] = useState(() => formatFactList(list));
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    if (!sameList(parseFactList(draft, field.key), list)) setDraft(formatFactList(list));
  }
  const max = FACT_LISTS[field.key];
  const count = splitFactList(draft).length;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{field.label}</label>
      <textarea
        id={id}
        rows={3}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const next = parseFactList(e.target.value, field.key);
          if (!sameList(next, list)) onEdit(next);
        }}
        aria-describedby={`${id}-hint`}
        className={`${INPUT} leading-relaxed`}
      />
      <span id={`${id}-hint`} className={HINT}>
        {field.hint} One per line or comma-separated. {Math.min(count, max)} of {max}
        {count > max && <span className="text-amber-800">: only the first {max} are kept</span>}.
      </span>
    </div>
  );
}
