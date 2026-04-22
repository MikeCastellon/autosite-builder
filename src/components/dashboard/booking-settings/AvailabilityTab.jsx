import { useState, useEffect } from 'react';
import { saveSchedulerConfig } from '../../../lib/schedulerConfig.js';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export default function AvailabilityTab({ siteId, config, onSaved }) {
  const [state, setState] = useState(() => normalize(config?.availability));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { setState(normalize(config?.availability)); }, [config]);

  function normalize(avail) {
    const out = {};
    for (const { key } of DAYS) {
      const windows = avail?.[key] || [];
      out[key] = windows.length
        ? { closed: false, start: windows[0].start, end: windows[0].end }
        : { closed: true, start: '09:00', end: '17:00' };
    }
    return out;
  }

  function setDay(key, patch) {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save() {
    setBusy(true); setErr(null);
    const availability = {};
    for (const { key } of DAYS) {
      const d = state[key];
      availability[key] = d.closed ? [] : [{ start: d.start, end: d.end }];
    }
    try {
      const updated = await saveSchedulerConfig(siteId, { availability });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden divide-y divide-gray-100">
        {DAYS.map(({ key, label }) => {
          const d = state[key];
          return (
            <div key={key} className="flex items-center gap-3 px-4 py-3">
              <div className="w-24 text-sm font-semibold text-gray-800">{label}</div>
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={(e) => setDay(key, { closed: e.target.checked })}
                />
                Closed
              </label>
              {!d.closed && (
                <>
                  <input type="time" value={d.start} onChange={(e) => setDay(key, { start: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-sm" />
                  <span className="text-gray-400 text-sm">to</span>
                  <input type="time" value={d.end} onChange={(e) => setDay(key, { end: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-sm" />
                </>
              )}
            </div>
          );
        })}
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000] disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save availability'}
      </button>
    </div>
  );
}
