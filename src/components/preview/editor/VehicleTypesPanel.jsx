// Edit > Vehicle Types: the kinds of vehicle the business works on
// (copy.vehicleTypes.items: a name, an optional line and one of the band's
// icons, VT_ICONS), and the band's heading and intro line (copy.vehicleTypes;
// Edit > Headings edits the same two and adds the small label and the
// highlighted words). The band is opt-in: it is on while
// copy.vehicleTypes exists, and the published page lists a card only once it
// has a name (kit/vehicleTypes.js).
//   confirm(message, { title, confirmText }) -> Promise<boolean>: the
//                       editor's dialog, before the section is removed
import { Label, Help, Note, Field, MoveButtons, dashedButtonClass, linkButtonClass } from './fields.jsx';
import { VehicleTypeIcon } from '../templates/kit/VehicleTypes.jsx';
import { VT_DEFAULTS, VT_ICON_LABELS } from '../templates/kit/vehicleTypes.js';
import {
  VT_TITLE_MAX, VT_INTRO_MAX, VT_NAME_MAX, VT_DESC_MAX, VT_MAX_ITEMS,
  vtValue, vtStart, vtRows, vtIconChoices, vtQuickPicks, vtSetText, vtSetItem, vtAddItem, vtRemoveItem, vtMoveItem, vtAddQuick,
} from './vehicleTypesEdit.js';

// size: 'w-8' for an icon, 'px-1.5 gap-1' for "Auto" + its icon (Tailwind
// gives no order between two width classes, so a chip only ever has one).
const chipClass = (picked, size) => `flex items-center justify-center h-8 ${size} rounded-md border transition ${
  picked ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
}`;

// The icon picker: "Auto" (the icon the name suggests, drawn on the button)
// and every one of the band's icons (VT_ICONS), as one radio group.
function IconPicker({ row, index, onPick }) {
  return (
    <div className="mb-4">
      <Label>Icon</Label>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Icon for vehicle ${index + 1}`}>
        {vtIconChoices().map((choice) => {
          const picked = row.icon === choice.id;
          const draw = choice.id || row.autoIcon;
          const label = choice.id ? choice.label : `Automatic (${VT_ICON_LABELS[row.autoIcon] || 'Car'}, from the name)`;
          return (
            <button key={choice.id || 'auto'} type="button" role="radio" aria-checked={picked} aria-label={label} title={label} className={chipClass(picked, choice.id ? 'w-8' : 'px-1.5 gap-1')} onClick={() => onPick(choice.id)}>
              {!choice.id && <span className="text-[10px] font-semibold">Auto</span>}
              <VehicleTypeIcon name={draw} size={18} stroke={1.75} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VehicleTypesPanel({ copy, setCopy, confirm, hasHeadingsTab = false }) {
  const vt = vtValue(copy);
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('vehicleTypes');
  const hiddenNote = hidden && <Note tone="warn" title="This section is switched off in Sections." />;

  if (!vt) {
    return (
      <>
        {hiddenNote}
        <Help className="mt-0 mb-3">Show the kinds of vehicles you work on, each as a card with an icon: cars, SUVs, boats, fleets and more.</Help>
        <button type="button" className={dashedButtonClass} onClick={() => setCopy('vehicleTypes', vtStart())}>
          + Add a Vehicle Types section
        </button>
      </>
    );
  }

  const rows = vtRows(copy);
  const quick = vtQuickPicks(copy);
  const write = (next) => { if (next) setCopy('vehicleTypes', next); };
  const removeSection = async () => {
    const ok = typeof confirm === 'function'
      ? await confirm('Remove the Vehicle Types section? Its cards come off your page too.', { title: 'Remove section?', confirmText: 'Remove' })
      : true;
    if (ok) setCopy('vehicleTypes', null);
  };
  const full = rows.length >= VT_MAX_ITEMS;

  return (
    <>
      {hiddenNote}
      <Field label="Heading" value={vt.title} onChange={(v) => write(vtSetText(vt, 'title', v))} placeholder={VT_DEFAULTS.title} maxLength={VT_TITLE_MAX} />
      <Field label="Intro line" value={vt.intro} onChange={(v) => write(vtSetText(vt, 'intro', v))} placeholder="Optional" maxLength={VT_INTRO_MAX} multiline rows={2} />
      {hasHeadingsTab && <Help className="-mt-2 mb-4">The small label above the heading and its highlighted words: Edit &gt; Headings.</Help>}

      <Label>Vehicles</Label>
      <Help className="mt-0 mb-3">A card shows on your site once it has a name. Up to {VT_MAX_ITEMS}.</Help>
      {rows.map((row, i) => (
        <div key={row.index} className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vehicle {i + 1}</p>
            <span className="flex items-center gap-1">
              <MoveButtons index={i} count={rows.length} onMove={(from, to) => write(vtMoveItem(vt, from, to))} label={`vehicle ${i + 1}`} />
              <button type="button" onClick={() => write(vtRemoveItem(vt, i))} className="ml-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
            </span>
          </div>
          <Field label="Name" value={row.name} onChange={(v) => write(vtSetItem(vt, i, 'name', v))} placeholder="e.g. Boats" maxLength={VT_NAME_MAX} />
          <Field label="Short line (optional)" value={row.desc} onChange={(v) => write(vtSetItem(vt, i, 'desc', v))} placeholder="e.g. Pontoons, bass boats and more" maxLength={VT_DESC_MAX} />
          <IconPicker row={row} index={i} onPick={(id) => write(vtSetItem(vt, i, 'icon', id))} />
          {!row.named && <Help tone="warn" className="-mt-2">Not on your site yet: it needs a name.</Help>}
        </div>
      ))}
      <button type="button" className={dashedButtonClass} disabled={full} onClick={() => write(vtAddItem(vt))}>
        {full ? `Up to ${VT_MAX_ITEMS} vehicles` : '+ Add a vehicle'}
      </button>
      {!full && quick.length > 0 && (
        <div className="mb-3">
          <Help className="mt-0 mb-1.5">Quick add:</Help>
          <div className="flex flex-wrap gap-1">
            {quick.map((q) => (
              <button key={q.icon} type="button" onClick={() => write(vtAddQuick(vt, q.icon))} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white text-[11px] font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 transition">
                <VehicleTypeIcon name={q.icon} size={14} stroke={2} />
                {q.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" className={linkButtonClass} onClick={removeSection}>Remove this section</button>
    </>
  );
}

export default VehicleTypesPanel;
