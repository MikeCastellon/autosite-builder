import { useState } from 'react';
import { saveSchedulerConfig, mergeServicesFromBusinessInfo } from '../../../lib/schedulerConfig.js';

function newService() {
  const id = 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
  return { id, name: '', duration_minutes: 60, price: '', description: '', enabled: true };
}

export default function ServicesTab({ siteId, config, businessInfo, onSaved }) {
  const [services, setServices] = useState(config?.services || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editingId, setEditingId] = useState(null);

  function patch(id, fields) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }

  function remove(id) {
    if (!confirm('Remove this service from booking? Existing bookings keep their service name.')) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function add() {
    const s = newService();
    setServices((prev) => [...prev, s]);
    setEditingId(s.id);
  }

  function resync() {
    const merged = mergeServicesFromBusinessInfo(services, businessInfo?.services);
    setServices(merged);
  }

  async function save() {
    const cleaned = services.filter((s) => s.name.trim() !== '')
      .map((s) => ({ ...s, duration_minutes: Math.max(15, Number(s.duration_minutes) || 60) }));
    setBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, { services: cleaned });
      onSaved && onSaved(updated);
      setServices(cleaned);
      setEditingId(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">Customers pick one of these when booking. Duration is used to block off time on your calendar.</p>
        <div className="flex gap-2">
          <button onClick={resync} className="text-xs text-gray-600 hover:text-[#1a1a1a] underline">Re-sync from site</button>
          <button onClick={add} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000]">+ Add service</button>
        </div>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
            <tr>
              <th className="px-4 py-3 w-16">On</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 w-28">Duration</th>
              <th className="px-4 py-3 w-24">Price</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const editing = editingId === s.id;
              return (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={s.enabled !== false} onChange={(e) => patch(s.id, { enabled: e.target.checked })} />
                  </td>
                  <td className="px-4 py-3">
                    {editing
                      ? <input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} className="w-full border border-gray-200 rounded px-2 py-1 text-sm" autoFocus />
                      : <span className="font-semibold text-gray-900">{s.name || <em className="text-gray-400">untitled</em>}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editing
                      ? <input type="number" min="15" step="15" value={s.duration_minutes} onChange={(e) => patch(s.id, { duration_minutes: Number(e.target.value) })} className="w-20 border border-gray-200 rounded px-2 py-1 text-sm" />
                      : <span className="text-gray-700">{s.duration_minutes} min</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editing
                      ? <input value={s.price || ''} onChange={(e) => patch(s.id, { price: e.target.value })} className="w-20 border border-gray-200 rounded px-2 py-1 text-sm" placeholder="$149" />
                      : <span className="text-gray-700">{s.price || '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditingId(editing ? null : s.id)}
                        aria-label={editing ? 'Done editing' : 'Edit service'}
                        title={editing ? 'Done' : 'Edit'}
                        className="p-1.5 rounded hover:bg-black/[0.05] text-gray-600 hover:text-[#1a1a1a] transition-colors"
                      >
                        {editing ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        )}
                      </button>
                      <button
                        onClick={() => remove(s.id)}
                        aria-label="Remove service"
                        title="Remove"
                        className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {services.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No services yet — click "+ Add service" or "Re-sync from site".</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000] disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save services'}
      </button>
    </div>
  );
}
