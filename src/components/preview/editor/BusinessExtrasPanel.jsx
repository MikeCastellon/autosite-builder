// Business Info additions (mounted after State): the one-line service area,
// the list of areas served, and the "Fully insured" switch. Templates read
// the areas through kit/content.js serviceAreasOf: the owner's list first,
// else the Service area line split into places (when that gives 2+ short
// names), else that line as one entry, else the city. Every write is one
// setBiz call per action.
import { Field, Label, Help, SwitchRow, TextListEditor, linkButtonClass } from './fields.jsx';

// The rows the list editor shows. An array is used as saved (blank rows the
// owner is still typing stay); an older comma-separated string is split the
// way serviceAreasOf reads it, and saved as an array on the first edit.
export function areaItems(serviceAreas) {
  if (Array.isArray(serviceAreas)) {
    return serviceAreas.map((a) => (typeof a === 'string' ? a : a == null ? '' : String(a)));
  }
  if (typeof serviceAreas === 'string') {
    return serviceAreas.split(/[,·;|\n]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// The places in the Service area line, when it already lists them
// ("Orlando, Lake Nona, Winter Park"): 2+ distinct parts of at most 40
// characters each, the same rule serviceAreasOf uses to split it on the
// site. null for a sentence like "Orlando and surrounding areas".
export function splitServiceArea(serviceArea) {
  if (typeof serviceArea !== 'string' || !serviceArea.trim()) return null;
  const seen = new Set();
  const parts = serviceArea.split(/\s*[,·;|\n]+\s*/).map((s) => s.trim()).filter((p) => {
    const k = p.toLowerCase();
    if (!p || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return parts.length >= 2 && parts.every((p) => p.length <= 40) ? parts : null;
}

export default function BusinessExtrasPanel({ businessInfo, setBiz, showAreas = true, showInsured = true }) {
  const areas = areaItems(businessInfo?.serviceAreas);
  // Offered only while no row has text, i.e. while the site falls back to
  // the Service area line anyway: copying it in changes nothing visible and
  // gives the owner rows to reorder or trim.
  const listEmpty = areas.every((a) => !a.trim());
  const fromLine = listEmpty ? splitServiceArea(businessInfo?.serviceArea) : null;

  return (
    <>
      <Field
        label="Service area"
        value={businessInfo?.serviceArea}
        onChange={(v) => setBiz('serviceArea', v)}
        placeholder="e.g. Orlando and surrounding areas"
        help="One line about where you work."
      />
      {showAreas && (
        <div className="mb-4">
          <Label>Areas served</Label>
          <TextListEditor
            items={areas}
            // Emptying the list removes the key, so the site goes back to
            // the Service area line (or the city).
            onChange={(list) => setBiz('serviceAreas', list.length ? list : null)}
            max={20}
            itemLabel="area"
            addLabel="+ Add area"
            placeholder="e.g. Lake Nona"
          />
          <Help className="mb-1">Each place on its own row, in the order to show them. Leave empty to use the Service area line.</Help>
          {fromLine && (
            <button type="button" className={linkButtonClass} onClick={() => setBiz('serviceAreas', fromLine)}>
              {`Use the ${fromLine.length} places from your Service area line`}
            </button>
          )}
        </div>
      )}
      {showInsured && (
        <SwitchRow
          label="Fully insured"
          on={businessInfo?.insured === true}
          onChange={(v) => setBiz('insured', v)}
          help="Only switch this on if you carry business insurance. Your page then says 'Fully Insured'."
        />
      )}
    </>
  );
}

export { BusinessExtrasPanel };
