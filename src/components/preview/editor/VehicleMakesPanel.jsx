// Vehicle Makes tab: which makes scroll across the template's band
// (copy.vehicleMakes). Ticking starts from what the band shows, so the
// first untick from the default keeps the other makes; makes the glyph set
// lacks are added by name under "Other makes" and show as text on the page.
// Every change is one setCopy('vehicleMakes', names | null).
// defaultAll (editorCapabilities vehicleMakesDefaultAll): null means every
// make (Redline), or, when false, no band (an opt-in band: it shows once the
// owner ticks a make, and "Clear all" removes it).
import { useState } from 'react';
import { Label, Help, Note, smallInputClass, linkButtonClass } from './fields.jsx';
import { VEHICLE_MAKES } from '../templates/kit/vehicleMakes.js';
import { CUSTOM_MAX_LEN, currentMakes, isPicked, toggleMake, addCustomMake, removeMake, customNames, clearKnownMakes, firstMakes, allMakes } from './vehicleMakesEdit.js';

const ERRORS = {
  duplicate: 'Already in the list.',
  long: `Use ${CUSTOM_MAX_LEN} characters or fewer.`,
  full: 'Up to 40 makes.',
};

export function VehicleMakesPanel({ copy, setCopy, defaultAll = true }) {
  const value = copy?.vehicleMakes;
  const opts = { defaultAll };
  const picked = currentMakes(value);
  const custom = customNames(value);
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('brands');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  // "Clear all" with no names of the owner's own: nothing can be saved for
  // an empty grid (empty = every make), so the grid shows unticked here and
  // the first tick saves that one make. An opt-in band needs none of this:
  // there, null already means no makes.
  const [clearedState, setCleared] = useState(false);
  const cleared = defaultAll && clearedState;
  const knownPicked = !cleared && VEHICLE_MAKES.some((m) => isPicked(value, m.name, opts));

  const write = (next) => {
    setCleared(false);
    setCopy('vehicleMakes', next);
  };
  const clearAll = () => {
    const next = clearKnownMakes(value);
    if (next) write(next);
    else setCleared(true);
  };
  const add = () => {
    const result = addCustomMake(value, draft, opts);
    if (result.error) {
      // An empty box is not worth a message: the Add button is disabled.
      setError(result.error === 'empty' ? null : result.error);
      return;
    }
    write(result.names);
    setDraft('');
    setError(null);
  };

  return (
    <>
      <Help className="mb-3">
        {defaultAll
          ? 'The band of car makes that scrolls across your page. Tick the makes you work on.'
          : 'The band of car makes that scrolls across your page. It shows once you tick at least one make.'}
      </Help>
      {hidden && <Note tone="warn" title="This band is switched off in Sections." />}

      {!defaultAll ? (
        picked === null ? (
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <Help className="">No band yet.</Help>
            <button type="button" className={linkButtonClass} onClick={() => write(allMakes())}>Show all makes</button>
          </div>
        ) : (
          <div className="mb-2">
            <div className="flex items-baseline justify-between gap-2">
              <Help className="">{picked.length} {picked.length === 1 ? 'make' : 'makes'} picked.</Help>
              <button type="button" className={linkButtonClass} onClick={() => write(null)}>Clear all</button>
            </div>
            <Help>Clear all removes the band from your page.</Help>
          </div>
        )
      ) : cleared ? (
        <Note title="Tick the makes you work on.">Until you tick one, your band keeps showing every make.</Note>
      ) : picked === null ? (
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <Help className="">Showing all {VEHICLE_MAKES.length} makes.</Help>
          <button type="button" className={linkButtonClass} onClick={clearAll}>Clear all</button>
        </div>
      ) : (
        <div className="mb-2">
          <div className="flex items-baseline justify-between gap-2">
            <Help className="">{picked.length} {picked.length === 1 ? 'make' : 'makes'} picked.</Help>
            <span className="flex gap-3">
              {knownPicked && <button type="button" className={linkButtonClass} onClick={clearAll}>Clear all</button>}
              <button type="button" className={linkButtonClass} onClick={() => write(null)}>Show all makes</button>
            </span>
          </div>
          <Help>With nothing picked the band shows every make. To hide the band, switch off Vehicle Makes in Sections.</Help>
        </div>
      )}

      {/* Two columns of ~95px in the editor panel: the name gets its own
          line under the checkbox and glyph, so "Mercedes-Benz" or
          "Lamborghini" reads in full instead of being cut. */}
      <div className="grid grid-cols-2 gap-1 mb-4">
        {VEHICLE_MAKES.map((m) => {
          const on = !cleared && isPicked(value, m.name, opts);
          return (
            <label
              key={m.id}
              className={`flex flex-col gap-1 min-w-0 px-2 py-1.5 rounded-lg border cursor-pointer transition ${
                on ? 'border-gray-300 bg-white text-gray-800' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="shrink-0 accent-gray-900"
                  checked={on}
                  aria-label={`Show ${m.name}`}
                  onChange={(e) => write(cleared ? firstMakes(m.name) : toggleMake(value, m.name, e.target.checked, opts))}
                />
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  <path d={m.d} fill="currentColor" />
                </svg>
              </span>
              <span className="text-[12px] leading-tight break-words">{m.name}</span>
            </label>
          );
        })}
      </div>

      <Label>Other makes</Label>
      {custom.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {custom.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-0.5 rounded-full bg-gray-100 text-[12px] text-gray-700">
              <span className="truncate">{name}</span>
              <button
                type="button"
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-white transition"
                aria-label={`Remove ${name}`}
                title="Remove"
                onClick={() => write(removeMake(value, name, opts))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          type="text"
          className={smallInputClass}
          value={draft}
          maxLength={CUSTOM_MAX_LEN}
          placeholder="e.g. Rivian"
          aria-label="Add a make"
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-gray-900 text-white hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!draft.trim()}
          onClick={add}
        >
          Add
        </button>
      </div>
      <Help tone={error ? 'error' : 'muted'}>{error ? ERRORS[error] : 'A make that is not in the grid shows as its name.'}</Help>
    </>
  );
}

export default VehicleMakesPanel;
