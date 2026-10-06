import { useState, useEffect } from 'react';
import { saveSchedulerConfig } from '../../../lib/schedulerConfig.js';
import { resolveShopTimeZone } from '../../../lib/shopTimeZone.js';

// Zones offered in the picker (the shop's own zone is added if it's not
// one of these). Booking times are the shop's wall clock; the zone tells
// the server how far ahead a slot is, for the lead time. Until the owner
// saves one here, the server uses the business state's zone, which is what
// the picker starts on (never the browser's: admins edit from elsewhere).
const TIME_ZONES = [
  { id: 'America/New_York', label: 'Eastern Time' },
  { id: 'America/Chicago', label: 'Central Time' },
  { id: 'America/Denver', label: 'Mountain Time' },
  { id: 'America/Phoenix', label: 'Arizona' },
  { id: 'America/Los_Angeles', label: 'Pacific Time' },
  { id: 'America/Anchorage', label: 'Alaska' },
  { id: 'Pacific/Honolulu', label: 'Hawaii' },
  { id: 'America/Puerto_Rico', label: 'Puerto Rico (Atlantic Time)' },
];

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export default function AvailabilityTab({ siteId, config, businessInfo, onSaved }) {
  const [state, setState] = useState(() => normalize(config?.availability));
  const [timeZone, setTimeZone] = useState(() => resolveShopTimeZone(config, businessInfo));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setState(normalize(config?.availability));
    setTimeZone(resolveShopTimeZone(config, businessInfo));
  }, [config, businessInfo]);

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
    setErr(null);
    const availability = {};
    for (const { key, label } of DAYS) {
      const d = state[key];
      // A day that closes before it opens has no slots: customers would
      // just see it greyed out, so catch it here.
      if (!d.closed && !(d.start && d.end && d.start < d.end)) {
        setErr(`${label}: the closing time must be after the opening time.`);
        return;
      }
      availability[key] = d.closed ? [] : [{ start: d.start, end: d.end }];
    }
    setBusy(true);
    try {
      const updated = await saveSchedulerConfig(siteId, { availability, timezone: timeZone });
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

      <label className="flex flex-wrap items-center gap-2 mt-4 text-sm text-gray-700">
        <span className="font-semibold">Time zone</span>
        <select
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          className="border border-gray-200 rounded px-2 py-1 text-sm"
        >
          {!TIME_ZONES.some((z) => z.id === timeZone) && <option value={timeZone}>{timeZone}</option>}
          {TIME_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
        <span className="text-xs text-gray-500">Hours and booking times are in this zone.</span>
      </label>

      {err && <p className="mt-3 text-sm text-red-600" role="alert">{err}</p>}

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
