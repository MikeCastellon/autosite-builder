import { useEffect, useState } from 'react';
import { saveSchedulerConfig } from '../../../lib/schedulerConfig.js';

export default function GeneralTab({ siteId, config, onSaved }) {
  const [welcome, setWelcome] = useState(config?.welcome_text || '');
  const [label, setLabel] = useState(config?.button_label || 'Book Now');
  const [lead, setLead] = useState(String(config?.lead_time_hours ?? 24));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setWelcome(config?.welcome_text || '');
    setLabel(config?.button_label || 'Book Now');
    setLead(String(config?.lead_time_hours ?? 24));
  }, [config]);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, {
        welcome_text: welcome,
        button_label: label || 'Book Now',
        lead_time_hours: Math.max(0, Number(lead) || 0),
      });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Welcome text</label>
        <textarea
          rows={3}
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />
        <p className="text-xs text-gray-500 mt-1">Shown at the top of the booking modal.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Button label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Minimum notice (hours)</label>
        <input
          type="number"
          min="0"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          className="w-32 border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />
        <p className="text-xs text-gray-500 mt-1">Customers can't book slots less than this far into the future.</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000] transition-colors disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
