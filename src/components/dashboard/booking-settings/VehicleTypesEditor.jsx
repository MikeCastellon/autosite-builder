// src/components/dashboard/booking-settings/VehicleTypesEditor.jsx
// Owner-managed list of vehicle types (Sedan, SUV, …). Drives the
// per-vehicle pricing rows in ServicesTab. Controlled: parent owns the
// array and persists it alongside services on Save.
import { newVehicleTypeId } from '../../../lib/schedulerConfig.js';
import { useAlert } from '../../ui/AlertProvider.jsx';

export default function VehicleTypesEditor({ vehicleTypes, onChange }) {
  const { confirm: confirmDialog } = useAlert();

  function patch(id, fields) {
    onChange(vehicleTypes.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  function move(id, dir) {
    const idx = vehicleTypes.findIndex((t) => t.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= vehicleTypes.length) return;
    const copy = [...vehicleTypes];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    onChange(copy);
  }

  async function remove(id) {
    const ok = await confirmDialog('Services stop having a separate price for this vehicle type. Existing bookings keep their vehicle info.', {
      title: 'Remove vehicle type?',
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    onChange(vehicleTypes.filter((t) => t.id !== id));
  }

  function add() {
    onChange([...vehicleTypes, { id: newVehicleTypeId(), name: '', enabled: true }]);
  }

  return (
    <div className="bg-white border border-black/[0.07] rounded-xl p-4 sm:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#1a1a1a]">Vehicle types</h3>
          <p className="text-xs text-gray-500 mt-0.5">Customers pick their vehicle right after the service — each service can charge a different price and time per type.</p>
        </div>
        <button type="button" onClick={add} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700">+ Add type</button>
      </div>
      <div className="space-y-2">
        {vehicleTypes.map((t, i) => (
          <div key={t.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={t.enabled !== false}
              onChange={(e) => patch(t.id, { enabled: e.target.checked })}
              title="Offer this vehicle type to customers"
            />
            <input
              value={t.name}
              onChange={(e) => patch(t.id, { name: e.target.value })}
              placeholder="e.g. Sedan"
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-white"
            />
            <button type="button" onClick={() => move(t.id, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 rounded text-gray-500 hover:bg-black/[0.05] disabled:opacity-30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button type="button" onClick={() => move(t.id, 1)} disabled={i === vehicleTypes.length - 1} aria-label="Move down" className="p-1.5 rounded text-gray-500 hover:bg-black/[0.05] disabled:opacity-30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button type="button" onClick={() => remove(t.id)} aria-label="Remove vehicle type" className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
