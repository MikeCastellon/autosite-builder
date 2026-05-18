import { Fragment, useState } from 'react';
import {
  saveSchedulerConfig,
  normalizeService,
  newAddonId,
  parseDollarsToCents,
  formatCentsAsDisplay,
} from '../../../lib/schedulerConfig.js';
import { useAlert } from '../../ui/AlertProvider.jsx';

function newService() {
  const id = 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
  return {
    id,
    name: '',
    duration_minutes: 60,
    price: '',
    price_cents: null,
    description: '',
    enabled: true,
    addons: [],
  };
}

function blankAddon() {
  return { id: newAddonId(), name: '', price_cents: 0, enabled: true };
}

export default function ServicesTab({ siteId, config, onSaved }) {
  const { confirm: confirmDialog } = useAlert();
  const [services, setServices] = useState(
    (config?.services || []).map((s) => normalizeService(s))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedAddonsId, setExpandedAddonsId] = useState(null);

  function patch(id, fields) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }

  function patchPrice(id, raw) {
    const cents = parseDollarsToCents(raw);
    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              price: raw,
              price_cents: cents,
            }
          : s
      )
    );
  }

  function patchAddon(serviceId, addonId, fields) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, addons: (s.addons || []).map((a) => (a.id === addonId ? { ...a, ...fields } : a)) }
          : s
      )
    );
  }

  function patchAddonPrice(serviceId, addonId, raw) {
    const cents = parseDollarsToCents(raw) ?? 0;
    patchAddon(serviceId, addonId, { price_cents: cents, _price_input: raw });
  }

  function addAddon(serviceId) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, addons: [...(s.addons || []), blankAddon()] } : s
      )
    );
  }

  function removeAddon(serviceId, addonId) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, addons: (s.addons || []).filter((a) => a.id !== addonId) } : s
      )
    );
  }

  async function remove(id) {
    const ok = await confirmDialog('Existing bookings keep their service name. You can always add it back later.', {
      title: 'Remove service from booking?',
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function add() {
    const s = newService();
    setServices((prev) => [...prev, s]);
    setEditingId(s.id);
  }

  async function save() {
    const cleaned = services
      .filter((s) => s.name.trim() !== '')
      .map((s) => {
        const cents = typeof s.price_cents === 'number' && s.price_cents > 0 ? s.price_cents : null;
        const display = cents != null ? formatCentsAsDisplay(cents) : (s.price || '');
        const addons = (s.addons || [])
          .filter((a) => a.name && a.name.trim() !== '')
          .map((a) => ({
            id: a.id,
            name: a.name.trim(),
            price_cents: Math.max(0, Math.round(Number(a.price_cents) || 0)),
            enabled: a.enabled !== false,
          }));
        return {
          ...s,
          duration_minutes: Math.max(15, Number(s.duration_minutes) || 60),
          price: display,
          price_cents: cents,
          addons,
        };
      });
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
        <p className="text-sm text-gray-600">Customers pick one of these when booking. Add-ons (optional extras) appear right after the customer picks a service — the total they pay reflects everything they select.</p>
        <button onClick={add} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000]">+ Add service</button>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
            <tr>
              <th className="px-4 py-3 w-16">On</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 w-28">Duration</th>
              <th className="px-4 py-3 w-28">Price</th>
              <th className="px-4 py-3 w-32">Add-ons</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const editing = editingId === s.id;
              const expanded = expandedAddonsId === s.id;
              const hasNumericPrice = typeof s.price_cents === 'number' && s.price_cents > 0;
              const addonCount = (s.addons || []).length;
              return (
                <Fragment key={s.id}>
                  <tr className="border-t border-gray-100">
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
                      {editing ? (
                        <input
                          value={s.price || ''}
                          onChange={(e) => patchPrice(s.id, e.target.value)}
                          onBlur={() => {
                            if (hasNumericPrice) patch(s.id, { price: formatCentsAsDisplay(s.price_cents) });
                          }}
                          className="w-24 border border-gray-200 rounded px-2 py-1 text-sm"
                          placeholder="$149"
                          inputMode="decimal"
                        />
                      ) : (
                        <span className={hasNumericPrice ? 'text-gray-700' : 'text-amber-600'}>
                          {hasNumericPrice
                            ? formatCentsAsDisplay(s.price_cents)
                            : (s.price ? `${s.price} (text only)` : '—')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasNumericPrice ? (
                        <button
                          type="button"
                          onClick={() => setExpandedAddonsId(expanded ? null : s.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-[#cc0000] transition-colors"
                        >
                          {expanded ? '▾' : '▸'} {addonCount === 0 ? 'Add add-ons' : `${addonCount} add-on${addonCount === 1 ? '' : 's'}`}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400" title="Set a numeric price to enable add-ons">Set price first</span>
                      )}
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

                  {expanded && hasNumericPrice && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add-ons for {s.name || 'this service'}</div>
                          <button
                            type="button"
                            onClick={() => addAddon(s.id)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700"
                          >
                            + Add an add-on
                          </button>
                        </div>
                        {(s.addons || []).length === 0 ? (
                          <div className="text-xs text-gray-500 italic py-2">No add-ons yet. Add optional extras like "Pet hair removal" or "Engine bay clean" — customers see them right after they pick this service.</div>
                        ) : (
                          <div className="space-y-2">
                            {s.addons.map((a) => (
                              <div key={a.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={a.enabled !== false}
                                  onChange={(e) => patchAddon(s.id, a.id, { enabled: e.target.checked })}
                                  title="Show this add-on to customers"
                                />
                                <input
                                  value={a.name}
                                  onChange={(e) => patchAddon(s.id, a.id, { name: e.target.value })}
                                  placeholder="Add-on name (e.g. Pet hair removal)"
                                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
                                />
                                <input
                                  value={a._price_input != null ? a._price_input : (a.price_cents > 0 ? formatCentsAsDisplay(a.price_cents) : '')}
                                  onChange={(e) => patchAddonPrice(s.id, a.id, e.target.value)}
                                  onBlur={() => {
                                    if (a.price_cents > 0) patchAddon(s.id, a.id, { _price_input: formatCentsAsDisplay(a.price_cents) });
                                  }}
                                  placeholder="$25"
                                  className="w-24 border border-gray-200 rounded px-2 py-1 text-sm"
                                  inputMode="decimal"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeAddon(s.id, a.id)}
                                  aria-label="Remove add-on"
                                  title="Remove"
                                  className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {services.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No services yet — click "+ Add service" or "Re-sync from site".</td></tr>
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
